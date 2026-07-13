const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "can",
  "do",
  "does",
  "for",
  "from",
  "how",
  "i",
  "if",
  "in",
  "is",
  "it",
  "my",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "use",
  "was",
  "what",
  "when",
  "where",
  "which",
  "why",
  "with",
  "you",
  "your",
  "一个",
  "什么",
  "如何",
  "怎么",
  "我的",
  "这个",
  "那个",
  "可以",
]);

const TECH_ALIASES = {
  "c++": "cplusplus",
  "c#": "csharp",
  js: "javascript",
  ts: "typescript",
};

const MAX_SEARCH_TERMS_LENGTH = 8_000;

const boundedInteger = (value, fallback, minimum, maximum) =>
  Number.isFinite(value)
    ? Math.max(minimum, Math.min(maximum, Math.trunc(value)))
    : fallback;

/**
 * @param {string} value
 * @param {number} [limit]
 * @param {number} [maxInputLength]
 * @returns {string[]}
 */
export function extractNormalizedQuestionTerms(
  value,
  limit = 24,
  maxInputLength = 20_000,
) {
  const safeLimit = boundedInteger(limit, 24, 1, 256);
  const safeInputLength = boundedInteger(maxInputLength, 20_000, 1, 20_000);
  const prepared = value
    .slice(0, safeInputLength)
    .normalize("NFKC")
    .replace(/https?:\/\/\S+/giu, " ")
    .replace(/[`*_~>[\](){}]/gu, " ")
    // Keep adjacent scripts searchable: "React状态" becomes "React 状态".
    .replace(/(\p{Script=Han})(?=[^\p{Script=Han}])/gu, "$1 ")
    .replace(/([^\p{Script=Han}])(?=\p{Script=Han})/gu, "$1 ");
  const groups =
    prepared.match(
      /[\p{Script=Han}]+|c\+\+|c#|[\p{L}\p{N}]+(?:[._-][\p{L}\p{N}]+)*(?:\+\+|#)?/giu,
    ) ?? [];
  const terms = [];
  const seen = new Set();

  /** @param {string} rawTerm */
  const addTerm = (rawTerm) => {
    const normalized = rawTerm.toLowerCase();
    const candidates = [normalized, TECH_ALIASES[normalized]].filter(Boolean);

    for (const term of candidates) {
      if (
        term.length < 2 ||
        term.length > 40 ||
        STOP_WORDS.has(term) ||
        seen.has(term)
      ) {
        continue;
      }

      seen.add(term);
      terms.push(term);
    }
  };

  for (const group of groups) {
    if (/^\p{Script=Han}+$/u.test(group)) {
      if (group.length <= 12) addTerm(group);
      for (let index = 0; index < group.length - 1; index += 1) {
        addTerm(group.slice(index, index + 2));
        if (terms.length >= safeLimit) return terms;
      }
    } else {
      addTerm(group);
      const camelCaseParts = group
        .replace(/([a-z\d])([A-Z])/g, "$1 $2")
        .split(/\s+/u);
      if (camelCaseParts.length > 1) {
        for (const part of camelCaseParts) addTerm(part);
      }
    }

    if (terms.length >= safeLimit) break;
  }

  return terms;
}

/**
 * Builds a bounded, normalized field for MongoDB text-index recall. Keeping
 * aliases such as csharp/cplusplus and Chinese bigrams in persisted data avoids
 * collection scans while still letting the deterministic scorer decide rank.
 *
 * @param {string} title
 * @param {string} content
 * @returns {string}
 */
export function buildQuestionSearchTerms(title, content) {
  const terms = [
    ...extractNormalizedQuestionTerms(title, 48, 100),
    ...extractNormalizedQuestionTerms(content, 208, 20_000),
  ];
  const uniqueTerms = [...new Set(terms)];
  const boundedTerms = [];
  let length = 0;

  for (const term of uniqueTerms) {
    const nextLength = length + term.length + (boundedTerms.length > 0 ? 1 : 0);
    if (nextLength > MAX_SEARCH_TERMS_LENGTH) break;
    boundedTerms.push(term);
    length = nextLength;
  }

  return boundedTerms.join(" ");
}
