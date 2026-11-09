import assert from "node:assert/strict";
import { test } from "node:test";
import { clean, dictationWordForms, gradeDictation, same, SPELL_GAP, spellSlotEdit, typingDelta, typingMetrics } from "./typing";

test("tapping a spelling cell selects the letter or creates blanks up to that cell", () => {
  assert.deepEqual(spellSlotEdit("hello wurld", ["hello", "world"], 1, 1), { value: "hello wurld", start: 7, end: 8 });
  const value = `he${SPELL_GAP.repeat(3)} ${SPELL_GAP.repeat(2)}`;
  assert.deepEqual(spellSlotEdit("he", ["hello", "world"], 1, 2), { value, start: value.length, end: value.length });
  assert.deepEqual(spellSlotEdit("a🌟 c", ["ab", "cd"], 0, 1), { value: "a🌟 c", start: 1, end: 3 });
});

test("dictation normalizes keyboard typography and marks case and punctuation without lowering the score", () => {
  assert.deepEqual(gradeDictation("  It’s   fine！  ", "It's fine!", true), { correct: true });
  const word = gradeDictation("  ＥＶＥＲＹＯＮＥ  ", "everyone", false);
  assert.ok(word.correct);
  assert.deepEqual(word.format?.kinds, ["cap"]);
  const sentence = gradeDictation("its fine?", "It's fine!", true);
  assert.ok(sentence.correct);
  assert.deepEqual(sentence.format?.submitted.filter((p) => p.kind), [
    { kind: "cap", text: "i" },
    { kind: "punct", text: "?" },
  ]);
  assert.deepEqual(sentence.format?.reference.filter((p) => p.kind), [
    { kind: "cap", text: "I" },
    { kind: "punct", text: "'" },
    { kind: "punct", text: "!" },
  ]);
  assert.deepEqual(gradeDictation("It's fine", "It's fine!", true).format?.kinds, ["punct"]);
  assert.deepEqual(gradeDictation("hello,world", "hello world", true).format?.kinds, ["punct"]);
});

test("dictation still rejects missing or misspelled words, missing word boundaries and empty answers", () => {
  assert.ok(!gradeDictation("Everyonee", "everyone", false).correct);
  assert.ok(!gradeDictation("its fne", "It's fine!", true).correct);
  assert.ok(!gradeDictation("fine!", "It's fine!", true).correct);
  assert.ok(!gradeDictation("alot", "a lot", true).correct);
  assert.ok(!gradeDictation("   ", "", false).correct);
  assert.ok(!gradeDictation("!?", "Hello!", true).correct);
});

test("word dictation accepts variants and optional words marked in textbook headwords", () => {
  assert.equal(dictationWordForms("grey (AmE gray )")[0], "grey");
  assert.equal(dictationWordForms("depend on / upon")[0], "depend on");
  assert.deepEqual(gradeDictation("gray", "grey (AmE gray )", false), { correct: true });
  assert.deepEqual(gradeDictation("at the back", "at the back (of)", false), { correct: true });
  assert.deepEqual(gradeDictation("at the back of", "at the back (of)", false), { correct: true });
  assert.deepEqual(gradeDictation("depend upon", "depend on / upon", false), { correct: true });
  assert.deepEqual(gradeDictation("cut sth into sth", "cut sth in / into sth", false), { correct: true });
  assert.deepEqual(gradeDictation("lots of", "a lot of / lots of", false), { correct: true });
  assert.deepEqual(gradeDictation("at the BACK (of)", "at the back (of)", false).format?.kinds, ["cap"]);
  assert.ok(!gradeDictation("upon", "depend on / upon", false).correct);
});

test("typing counts inserted characters and does not reward deletions", () => {
  assert.deepEqual(typingDelta("", "c", "cat"), { total: 1, correct: 1 });
  assert.deepEqual(typingDelta("c", "cx", "cat"), { total: 1, correct: 0 });
  assert.deepEqual(typingDelta("cx", "c", "cat"), { total: 0, correct: 0 });
  assert.deepEqual(typingDelta("cat", "cat", "cat"), { total: 0, correct: 0 });
});

test("a corrected mistake remains in the cumulative accuracy denominator", () => {
  let total = 0,
    correct = 0,
    previous = "";
  for (const value of ["c", "cx", "c", "ca", "cat"]) {
    const delta = typingDelta(previous, value, "cat");
    total += delta.total;
    correct += delta.correct;
    previous = value;
  }
  assert.deepEqual(typingMetrics(correct, total, 3, 6000), {
    accuracy: 75,
    wpm: 6,
  });
});

test("replacement and middle insertion assess only new characters at their new positions", () => {
  assert.deepEqual(typingDelta("cxt", "cat", "cat"), { total: 1, correct: 1 });
  assert.deepEqual(typingDelta("cat", "cart", "cart"), {
    total: 1,
    correct: 1,
  });
  assert.deepEqual(typingDelta("cart", "cat", "cat"), { total: 0, correct: 0 });
  assert.deepEqual(typingDelta("cat", "cats", "cat"), { total: 1, correct: 0 });
});

test("case and equivalent smart punctuation are accepted, punctuation is still required", () => {
  assert.ok(same("Cat", "cat"));
  assert.ok(same("It’s fine.", "It's fine."));
  assert.ok(!same("Its fine", "It's fine."));
  assert.ok(!same("cat ", "cat"));
  assert.deepEqual(typingDelta("", "Cat", "cat"), { total: 3, correct: 3 });
  assert.equal(clean("Ａ—Ｂ"), "A-B");
});

test("IME commits or multi-character replacements are assessed as one insertion", () => {
  assert.deepEqual(typingDelta("", "hello", "hello"), { total: 5, correct: 5 });
  assert.deepEqual(typingDelta("hel", "hello", "hello"), {
    total: 2,
    correct: 2,
  });
  assert.deepEqual(typingDelta("hello", "hello", "hello"), {
    total: 0,
    correct: 0,
  });
  assert.deepEqual(typingDelta("", "你好", "hello"), { total: 2, correct: 0 });
});

test("WPM uses five characters per word and excludes discarded error characters", () => {
  assert.deepEqual(typingMetrics(200, 250, 200, 60000), {
    accuracy: 80,
    wpm: 40,
  });
  assert.deepEqual(typingMetrics(150, 150, 150, 30000), {
    accuracy: 100,
    wpm: 60,
  });
});

test("an untouched or subsecond round never reports infinite or misleading WPM", () => {
  assert.deepEqual(typingMetrics(0, 0, 0, 0), { accuracy: 100, wpm: 0 });
  assert.equal(typingMetrics(1, 1, 1, 20).wpm, 0);
  assert.equal(typingMetrics(50, 50, 50, 999).wpm, 0);
});

test("normalized ligatures count as the same displayed characters", () => {
  assert.deepEqual(typingDelta("", "oﬃce", "office"), { total: 6, correct: 6 });
  assert.deepEqual(typingDelta("oﬃce", "office", "office"), { total: 0, correct: 0 });
});

test("decomposed accents normalize before positions and accuracy are assessed", () => {
  assert.deepEqual(typingDelta("", "cafe\u0301", "café"), { total: 4, correct: 4 });
  assert.deepEqual(typingDelta("café", "cafe\u0301", "café"), { total: 0, correct: 0 });
});

test("supplementary Unicode characters do not shift the following letter positions", () => {
  assert.deepEqual(typingDelta("", "𝔸B", "AB"), { total: 2, correct: 2 });
  assert.deepEqual(typingDelta("", "🙂a", "🙂a"), { total: 2, correct: 2 });
});

test("source nonbreaking spaces match keyboard spaces but omitted punctuation does not", () => {
  assert.ok(same("a b", "a\u00a0b"));
  assert.deepEqual(typingDelta("", "a b", "a\u00a0b"), { total: 3, correct: 3 });
  assert.ok(!same("well being", "well-being"));
});

test("metrics never emit NaN, Infinity, negatives or accuracy above 100", () => {
  assert.deepEqual(typingMetrics(20, 10, 10, 60000), { accuracy: 100, wpm: 2 });
  assert.deepEqual(typingMetrics(-1, 10, -10, 60000), { accuracy: 0, wpm: 0 });
  assert.deepEqual(typingMetrics(NaN, Infinity, 2, Infinity), { accuracy: 100, wpm: 0 });
});
