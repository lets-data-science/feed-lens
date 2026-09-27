import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { READING_CASES } from "../lib/reading-cases.mjs";
import {
  decideReading,
  readingQuestions,
  askReadingJev,
} from "../lib/reading.mjs";
test("practice cases reproduce the decisions taught in the guide", () => {
  for (const post of READING_CASES)
    assert.equal(decideReading(post.answers).verdict, post.expected);
  const example = READING_CASES[2];
  assert.equal(
    decideReading(example.answers, { minUsefulness: 0.55 }).verdict,
    "read",
  );
  assert.equal(
    decideReading(example.answers, { minUsefulness: 0.8 }).verdict,
    "skip",
  );
  assert.equal(decideReading(example.answers).score, 60);
});
test("the application has no extra runtime dependency", async () => {
  const pkg = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  assert.equal(Object.keys(pkg.dependencies || {}).length, 0);
});
test("the complete questions preserve one judgement per output", () => {
  assert.deepEqual(Object.keys(readingQuestions()).sort(), [
    "bait",
    "relevance",
    "usefulness",
  ]);
});
