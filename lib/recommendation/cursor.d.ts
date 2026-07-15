export type FeedCursorErrorCode =
  | "INVALID_CURSOR"
  | "CURSOR_TOO_LONG"
  | "INVALID_SECRET"
  | "CONTEXT_MISMATCH"
  | "CURSOR_EXPIRED";

export class FeedCursorError extends Error {
  readonly code: FeedCursorErrorCode;
  constructor(code: FeedCursorErrorCode, message?: string);
}

export interface FeedCursorPayload {
  readonly v: 1;
  readonly asOf: string;
  readonly score: number;
  readonly createdAt: string;
  readonly id: string;
  readonly contextHash: string;
}

export interface FeedCursorInput {
  asOf: Date | string;
  score: number;
  createdAt: Date | string;
  id: string;
  contextHash: string;
}

export interface DecodeFeedCursorOptions {
  secret: string;
  expectedContextHash: string;
  now?: Date | string | number;
  maxAgeMs?: number;
}

export function createFeedContextHash(context: Record<string, unknown>): string;

export function encodeFeedCursor(
  input: FeedCursorInput,
  secret: string,
): string;

export function decodeFeedCursor(
  token: string,
  options: DecodeFeedCursorOptions,
): FeedCursorPayload;
