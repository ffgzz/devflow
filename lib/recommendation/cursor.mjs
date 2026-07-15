import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const CURSOR_VERSION = 1;
const MAX_CURSOR_LENGTH = 1_024;
const MAX_CONTEXT_JSON_LENGTH = 4_096;
const MAX_CONTEXT_DEPTH = 6;
const MAX_ID_LENGTH = 128;
const MAX_SECRET_LENGTH = 1_024;
const ALLOWED_CLOCK_SKEW_MS = 5 * 60 * 1_000;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
const CONTEXT_HASH_PATTERN = /^[a-f0-9]{64}$/u;
const ID_PATTERN = /^[A-Za-z0-9:_-]+$/u;
const EXACT_PAYLOAD_KEYS = [
  "asOf",
  "contextHash",
  "createdAt",
  "id",
  "score",
  "v",
];

export class FeedCursorError extends Error {
  code;

  constructor(code, message = "Invalid feed cursor.") {
    super(message);
    this.name = "FeedCursorError";
    this.code = code;
  }
}

const fail = (code = "INVALID_CURSOR", message = "Invalid feed cursor.") => {
  throw new FeedCursorError(code, message);
};

const validateSecret = (secret) => {
  if (typeof secret !== "string") {
    return fail("INVALID_SECRET", "Feed cursor secret is missing.");
  }

  const byteLength = Buffer.byteLength(secret, "utf8");
  if (byteLength < 16 || byteLength > MAX_SECRET_LENGTH) {
    return fail(
      "INVALID_SECRET",
      "Feed cursor secret must contain between 16 and 1024 bytes.",
    );
  }

  return secret;
};

const canonicalIso = (value, fieldName) => {
  if (!(value instanceof Date) && typeof value !== "string") {
    return fail("INVALID_CURSOR", `${fieldName} must be an ISO date.`);
  }

  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return fail("INVALID_CURSOR", `${fieldName} must be an ISO date.`);
  }

  const iso = date.toISOString();
  if (typeof value === "string" && value !== iso) {
    return fail("INVALID_CURSOR", `${fieldName} must be a canonical ISO date.`);
  }

  return iso;
};

const validateScore = (score) => {
  if (typeof score !== "number" || !Number.isSafeInteger(score)) {
    return fail("INVALID_CURSOR", "Feed cursor score must be a safe integer.");
  }
  return score;
};

const validateId = (id) => {
  if (
    typeof id !== "string" ||
    id.length === 0 ||
    id.length > MAX_ID_LENGTH ||
    !ID_PATTERN.test(id)
  ) {
    return fail("INVALID_CURSOR", "Feed cursor id is invalid.");
  }
  return id;
};

const validateContextHash = (hash) => {
  if (typeof hash !== "string" || !CONTEXT_HASH_PATTERN.test(hash)) {
    return fail("INVALID_CURSOR", "Feed cursor context hash is invalid.");
  }
  return hash;
};

const normalizePayload = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fail();
  }

  const record = value;
  const keys = Object.keys(record).sort();
  if (
    keys.length !== EXACT_PAYLOAD_KEYS.length ||
    !keys.every((key, index) => key === EXACT_PAYLOAD_KEYS[index])
  ) {
    return fail();
  }
  if (record.v !== CURSOR_VERSION) return fail();

  const asOf = canonicalIso(record.asOf, "asOf");
  const createdAt = canonicalIso(record.createdAt, "createdAt");
  if (new Date(createdAt).getTime() > new Date(asOf).getTime()) {
    return fail(
      "INVALID_CURSOR",
      "Feed cursor item is newer than its snapshot.",
    );
  }

  return Object.freeze({
    v: CURSOR_VERSION,
    asOf,
    score: validateScore(record.score),
    createdAt,
    id: validateId(record.id),
    contextHash: validateContextHash(record.contextHash),
  });
};

const serializePayload = (payload) =>
  JSON.stringify({
    v: payload.v,
    asOf: payload.asOf,
    score: payload.score,
    createdAt: payload.createdAt,
    id: payload.id,
    contextHash: payload.contextHash,
  });

const sign = (encodedPayload, secret) =>
  createHmac("sha256", secret).update(encodedPayload, "utf8").digest();

const decodeBase64Url = (segment) => {
  if (
    !segment ||
    !BASE64URL_PATTERN.test(segment) ||
    segment.length % 4 === 1
  ) {
    return fail();
  }

  const decoded = Buffer.from(segment, "base64url");
  if (decoded.toString("base64url") !== segment) return fail();
  return decoded;
};

const canonicalizeContext = (value, depth, ancestors) => {
  if (depth > MAX_CONTEXT_DEPTH) {
    throw new TypeError("Feed context exceeds the maximum nesting depth.");
  }
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.length > 512)
      throw new TypeError("Feed context string is too long.");
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Feed context numbers must be finite.");
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) {
      throw new TypeError("Feed context contains an invalid date.");
    }
    return value.toISOString();
  }
  if (typeof value !== "object" || value === null) {
    throw new TypeError("Feed context contains an unsupported value.");
  }
  if (ancestors.has(value)) {
    throw new TypeError("Feed context must not contain circular references.");
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (value.length > 50)
        throw new TypeError("Feed context array is too long.");
      return value.map((entry) =>
        canonicalizeContext(entry, depth + 1, ancestors),
      );
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Feed context must contain only plain objects.");
    }

    const entries = Object.entries(value);
    if (entries.length > 50) {
      throw new TypeError("Feed context object has too many fields.");
    }

    const result = {};
    for (const [key, entry] of entries.sort(([a], [b]) => a.localeCompare(b))) {
      if (
        !key ||
        key.length > 80 ||
        key === "__proto__" ||
        key === "constructor" ||
        key === "prototype"
      ) {
        throw new TypeError("Feed context contains an invalid key.");
      }
      result[key] = canonicalizeContext(entry, depth + 1, ancestors);
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
};

/** Creates a deterministic hash that binds a cursor to one feed/query/user. */
export function createFeedContextHash(context) {
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    throw new TypeError("Feed context must be a plain object.");
  }

  const canonical = canonicalizeContext(context, 0, new WeakSet());
  const serialized = JSON.stringify(canonical);
  if (serialized.length > MAX_CONTEXT_JSON_LENGTH) {
    throw new TypeError("Feed context is too large.");
  }

  return createHash("sha256").update(serialized, "utf8").digest("hex");
}

/** Encodes and signs one opaque v1 feed cursor. */
export function encodeFeedCursor(input, secret) {
  const safeSecret = validateSecret(secret);
  const payload = normalizePayload({ v: CURSOR_VERSION, ...input });
  const encodedPayload = Buffer.from(
    serializePayload(payload),
    "utf8",
  ).toString("base64url");
  const signature = sign(encodedPayload, safeSecret).toString("base64url");
  const cursor = `${encodedPayload}.${signature}`;

  if (cursor.length > MAX_CURSOR_LENGTH) {
    return fail("CURSOR_TOO_LONG", "Feed cursor is too long.");
  }
  return cursor;
}

/** Verifies, parses, and context-binds one opaque v1 feed cursor. */
export function decodeFeedCursor(token, options) {
  if (typeof token !== "string" || token.length === 0) return fail();
  if (token.length > MAX_CURSOR_LENGTH) {
    return fail("CURSOR_TOO_LONG", "Feed cursor is too long.");
  }
  if (!options || typeof options !== "object") return fail();

  const safeSecret = validateSecret(options.secret);
  const expectedContextHash = validateContextHash(options.expectedContextHash);
  const segments = token.split(".");
  if (segments.length !== 2) return fail();

  const [encodedPayload, encodedSignature] = segments;
  const suppliedSignature = decodeBase64Url(encodedSignature);
  const expectedSignature = sign(encodedPayload, safeSecret);
  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    return fail();
  }

  const payloadBuffer = decodeBase64Url(encodedPayload);
  let parsed;
  try {
    parsed = JSON.parse(payloadBuffer.toString("utf8"));
  } catch {
    return fail();
  }

  const payload = normalizePayload(parsed);
  if (
    Buffer.from(serializePayload(payload), "utf8").toString("base64url") !==
    encodedPayload
  ) {
    return fail();
  }
  if (payload.contextHash !== expectedContextHash) {
    return fail(
      "CONTEXT_MISMATCH",
      "Feed cursor belongs to a different feed context.",
    );
  }

  const now =
    options.now === undefined
      ? Date.now()
      : options.now instanceof Date
        ? options.now.getTime()
        : new Date(options.now).getTime();
  if (!Number.isFinite(now)) return fail();

  const asOfMs = new Date(payload.asOf).getTime();
  if (asOfMs > now + ALLOWED_CLOCK_SKEW_MS) return fail();

  if (options.maxAgeMs !== undefined) {
    if (!Number.isFinite(options.maxAgeMs) || options.maxAgeMs <= 0) {
      return fail("INVALID_CURSOR", "maxAgeMs must be positive.");
    }
    if (now - asOfMs > options.maxAgeMs) {
      return fail("CURSOR_EXPIRED", "Feed cursor has expired.");
    }
  }

  return payload;
}
