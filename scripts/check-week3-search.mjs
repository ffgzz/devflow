import assert from "node:assert/strict";
import {
  buildQuestionSearchTerms,
  extractNormalizedQuestionTerms,
} from "../lib/search/question-search-terms.mjs";

const mixedTerms = extractNormalizedQuestionTerms(
  "React状态闭包问题 Next.js缓存失效",
  64,
);
for (const expected of ["react", "状态", "闭包", "next.js", "缓存"]) {
  assert.ok(mixedTerms.includes(expected), `Missing mixed-script term: ${expected}`);
}
const relatedMixedTerms = new Set(
  extractNormalizedQuestionTerms("React状态闭包怎么解决", 64),
);
assert.ok(
  ["状态", "闭包"].every(
    (term) => mixedTerms.includes(term) && relatedMixedTerms.has(term),
  ),
  "Adjacent Chinese/English titles lost their shared recall terms",
);

const technicalTerms = buildQuestionSearchTerms(
  "C++ 和 C# 的 JS/TS 互操作",
  "需要定位 useEffect 中的错误",
).split(/\s+/u);
for (const expected of [
  "cplusplus",
  "csharp",
  "javascript",
  "typescript",
  "useeffect",
]) {
  assert.ok(technicalTerms.includes(expected), `Missing alias: ${expected}`);
}

const sentinel = "must-not-be-indexed";
const boundedTerms = buildQuestionSearchTerms(
  "Bounded input",
  `${"safe ".repeat(5_000)}${sentinel}`,
);
assert.ok(boundedTerms.length <= 8_000, "Persisted search terms exceed 8 KB");
assert.ok(!boundedTerms.includes(sentinel), "Content after 20 KB was tokenized");

process.stdout.write("Week 3 search-term checks passed.\n");
