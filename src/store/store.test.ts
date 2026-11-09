import assert from "node:assert/strict";
import { test } from "node:test";
import type { Atlas, WordRef } from "../atlas/types";
import { sessionFor, withSession } from "./session";
import { emptyProgress, sanitizeProgress, sanitizeSettings, type ActiveSession } from "./store";
import { forgetResolvedWord, practiceKey, removeWordMistake, updatePracticeReview } from "./practiceReview";

const card = { due: 1, s: 2, d: 5, el: 0, sd: 1, ls: 0, reps: 1, lapses: 0, st: 2, seen: 1 };

test("switching books keeps each journey and files a legacy journey under its original book", () => {
  const makeBook = (book: string, id: string) => {
    const ref: WordRef = { id, order: 0, word: id, zh: "", ipa: "", cefr: 0, topic: 0, media: 0 };
    return { book, words: [ref], byId: new Map([[id, ref]]) } as Atlas;
  };
  const seven = makeBook("7a", "hello");
  const nine = makeBook("fltrp9a", "fltrp9a-lady");
  const shelf = [seven, nine];
  const current = { ...nine, shelf, byId: new Map([...nine.byId, ...seven.byId]) };
  const makeSession = (id: string): ActiveSession => ({
    id, started: 1, steps: [{ id, kind: "intro" }, { id, kind: "meaning" }],
    index: 1, graded: {}, newIds: [id], reviewIds: [],
  });
  const old = makeSession("hello");
  const fresh = makeSession("fltrp9a-lady");
  const legacy = { ...emptyProgress("pep-7a"), session: old };
  assert.equal(sessionFor(current, legacy), null);
  const saved = sanitizeProgress(JSON.parse(JSON.stringify(withSession(current, legacy, fresh))), "pep-7a");
  assert.deepEqual(sessionFor(seven, saved), old);
  assert.deepEqual(sessionFor(current, saved), fresh);
  const done = withSession(current, saved, null);
  assert.equal(sessionFor(current, done), null);
  assert.deepEqual(sessionFor(seven, done), old);
});

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
test("removing a wrong word cancels its pending reviews across modes and books", () => {
  const word = { id: "hello", book: "7a", mode: "word" } as const;
  const sentence = { id: "hello", book: "7b", mode: "sentence" } as const;
  const other = { ...word, id: "world" };
  let reviews = updatePracticeReview({}, word, false, 0);
  reviews = updatePracticeReview(reviews, sentence, false, 0);
  reviews = updatePracticeReview(reviews, other, false, 0);
  const mistakes = ["hello", "world"];
  assert.equal(forgetResolvedWord(mistakes, reviews, "hello"), mistakes);
  const removed = removeWordMistake(mistakes, reviews, "hello");
  assert.deepEqual(removed.mistakes, ["world"]);
  assert.deepEqual(Object.keys(removed.practiceReviews), [practiceKey(other)]);
  assert.deepEqual(forgetResolvedWord(mistakes, removed.practiceReviews, "hello"), ["world"]);
});
