import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeProgress, sanitizeSettings } from "./store";
import { practiceKey, updatePracticeReview } from "./practiceReview";

const card = { due: 1, s: 2, d: 5, el: 0, sd: 1, ls: 0, reps: 1, lapses: 0, st: 2, seen: 1 };

test("keeps valid progress and drops malformed records", () => {
  const p = sanitizeProgress(
    {
      version: 2,
      cards: { ok: card, bad: { ...card, d: 99 }, worse: "x" },
      bookmarks: ["ok", 3],
      days: { "2026-10-25": { n: 1, r: 2, c: 1, t: 30 }, nope: { n: 1, r: 1, c: 1, t: 1 } },
      typing: [{ at: 1, mode: "word", items: 10, wpm: 40, accuracy: 98 }, { at: 1, mode: "hack", items: 1, wpm: 1, accuracy: 1 }],
    },
    "word-atlas-open",
  );
  assert.deepEqual(Object.keys(p.cards), ["ok"]);
  assert.deepEqual(p.bookmarks, ["ok"]);
  assert.deepEqual(Object.keys(p.days), ["2026-10-25"]);
  assert.equal(p.typing.length, 1);
});

test("rejects other versions and unknown settings", () => {
  assert.deepEqual(sanitizeProgress({ version: 1, cards: { ok: card } }, "x").cards, {});
  const s = sanitizeSettings({ accent: "fr", dailyNew: 1e9, theme: "dark", retention: 0.5 });
  assert.equal(s.accent, "uk");
  assert.equal(s.dailyNew, 10);
  assert.equal(s.theme, "dark");
  assert.equal(s.retention, 0.9);
});

test("dictation mistakes survive backups and only advance when a review is due", () => {
  const prompt = { id: "everyone", book: "9", mode: "word" } as const;
  const sentence = { ...prompt, mode: "sentence" } as const;
  const key = practiceKey(prompt);
  const minute = 60_000;
  const day = 24 * 60 * minute;
  const old = sanitizeProgress({ version: 2, mistakes: [prompt.id] }, "x");
  assert.deepEqual(old.mistakes, [prompt.id]);
  assert.deepEqual(old.practiceReviews, {});

  const missed = updatePracticeReview(old.practiceReviews, prompt, false, 0);
  const both = updatePracticeReview(missed, sentence, false, 0);
  const restored = sanitizeProgress(JSON.parse(JSON.stringify({ ...old, practiceReviews: { ...both, bad: { ...both[key], stage: -1 } } })), "x");
  assert.deepEqual(restored.practiceReviews, both);
  assert.equal(both[key].due, 20 * minute);
  assert.equal(updatePracticeReview(both, prompt, true, 20 * minute - 1), both);

  const later = updatePracticeReview(both, prompt, true, 25 * minute);
  assert.equal(later[key].stage, 1);
  assert.equal(later[key].due, 85 * minute);
  assert.equal(later[practiceKey(sentence)], both[practiceKey(sentence)]);
  const reset = updatePracticeReview(later, prompt, false, later[key].due);
  assert.equal(reset[key].stage, 0);
  assert.equal(reset[key].due, 105 * minute);

  let reviews = later;
  for (const gap of [9 * 60 * minute, day, 2 * day, 6 * day, 31 * day]) {
    const due = reviews[key].due;
    reviews = updatePracticeReview(reviews, prompt, true, due);
    assert.equal(reviews[key].due, due + gap);
  }
  reviews = updatePracticeReview(reviews, prompt, true, reviews[key].due);
  assert.deepEqual(reviews, { [practiceKey(sentence)]: both[practiceKey(sentence)] });
});
