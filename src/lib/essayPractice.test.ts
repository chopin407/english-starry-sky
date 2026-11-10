import assert from "node:assert/strict";
import { test } from "node:test";
import { essayOpenings, gradeEssay } from "./essayPractice";

const reference = "My school has a garden.\n\nI like reading there.";

test("essay grading accepts reflowed paragraphs and marks formatting without counting it wrong", () => {
  assert.equal(gradeEssay("My school has a garden. I like reading there.", reference).correct, true);
  const result = gradeEssay("my school has a garden I like reading there.", reference);
  assert.equal(result.correct, true);
  assert.deepEqual(result.formats, ["cap", "punct"]);
  assert.equal(result.matched, result.total);
  assert.ok(result.reference.some(({ text, mark }) => mark === "punct" && text.includes(".")));
});

test("an omission or a substitution does not shift the following paragraph", () => {
  const result = gradeEssay("My school has garden. I enjoy reading there.", reference);
  assert.equal(result.correct, false);
  assert.equal(result.matched, 7);
  assert.deepEqual(result.reference.filter(({ mark }) => mark).map(({ text }) => text), ["a", "like"]);
  assert.deepEqual(result.draft.filter(({ mark }) => mark).map(({ text }) => text), ["enjoy"]);
  assert.equal(result.reference.map(({ text }) => text).join(""), reference);
});

test("extra words are marked even when all reference words are present", () => {
  const result = gradeEssay("My school has a big garden. I like reading there.", reference);
  assert.equal(result.correct, false);
  assert.equal(result.matched, result.total);
  assert.deepEqual(result.draft.filter(({ mark }) => mark).map(({ text }) => text), ["big"]);
});

test("opening hints use the chosen version and show only the first three words per paragraph", () => {
  assert.deepEqual(essayOpenings(["  My\n school has a garden.", "I like reading there."]), ["My school has", "I like reading"]);
});
