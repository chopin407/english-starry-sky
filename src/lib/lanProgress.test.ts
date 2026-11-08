import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultSettings, emptyProgress } from "../store/store";
import { practiceKey, updatePracticeReview } from "../store/practiceReview";
import { mergeLanSnapshots, sameSnapshot, type LanSnapshot } from "./lanProgress";

const snapshot = (): LanSnapshot => ({
  app: "word-atlas", version: 2, progress: emptyProgress("pep-7a"), settings: { ...defaultSettings }, qa: {},
});

test("concurrent study and settings changes rebase against the shared version", () => {
  const base = snapshot();
  const day = "2026-11-08";
  base.progress.days[day] = { n: 1, r: 4, c: 3, t: 20 };
  base.progress.bookmarks = ["hello"];
  base.qa = { q: { n: 2, ok: 1, last: false, at: 100, kp: "语法" } };
  const local = structuredClone(base);
  local.progress.days[day].r += 2;
  local.progress.bookmarks = [];
  local.progress.mistakes = ["wrong"];
  local.settings.autoplay = false;
  local.qa = { q: { n: 3, ok: 2, last: true, at: 110, kp: "语法" } };
  const remote = structuredClone(base);
  remote.progress.days[day].r += 2;
  remote.progress.bookmarks.push("world");
  remote.settings.dailyNew = 15;
  remote.qa = { q: { n: 3, ok: 1, last: false, at: 120, kp: "语法" } };
  const merged = mergeLanSnapshots(base, local, remote);
  assert.deepEqual(merged.progress.days[day], { n: 1, r: 8, c: 3, t: 20 });
  assert.deepEqual(merged.progress.bookmarks, ["world"]);
  assert.deepEqual(merged.progress.mistakes, ["wrong"]);
  assert.equal(merged.settings.autoplay, false);
  assert.equal(merged.settings.dailyNew, 15);
  assert.deepEqual(merged.qa, { q: { n: 4, ok: 2, last: false, at: 120, kp: "语法" } });
  assert.ok(sameSnapshot(mergeLanSnapshots(remote, remote, merged), merged));
});

test("same word and dictation review conflicts keep the latest schedule", () => {
  const base = snapshot();
  const local = snapshot();
  const remote = snapshot();
  const card = { due: 200, s: 1, d: 2, el: 0, sd: 0, ls: 0, st: 1, reps: 1, lapses: 0, seen: 1 };
  local.progress.cards.hello = { ...card, last: 100 } as typeof local.progress.cards[string];
  remote.progress.cards.hello = { ...card, last: 150, due: 250 } as typeof remote.progress.cards[string];
  const prompt = { book: "7a", id: "hello", mode: "word" } as const;
  const missed = updatePracticeReview({}, prompt, false, 100);
  local.progress.practiceReviews = updatePracticeReview(missed, prompt, true, 1_200_100);
  remote.progress.practiceReviews = updatePracticeReview(missed, prompt, false, 1_200_200);
  const merged = mergeLanSnapshots(base, local, remote);
  assert.equal(merged.progress.cards.hello.due, 250);
  assert.equal(merged.progress.cards.hello.reps, 2);
  assert.equal(merged.progress.practiceReviews[practiceKey(prompt)].stage, 0);
});

test("initial login keeps server settings and does not double-count overlapping legacy data", () => {
  const local = snapshot();
  const remote = snapshot();
  local.progress.days["2026-11-08"] = { n: 2, r: 4, c: 3, t: 20 };
  remote.progress.days["2026-11-08"] = { n: 2, r: 4, c: 3, t: 20 };
  local.progress.bookmarks = ["guest"];
  remote.progress.bookmarks = ["server"];
  remote.settings.dailyNew = 15;
  const merged = mergeLanSnapshots(null, local, remote);
  assert.equal(merged.progress.days["2026-11-08"].r, 4);
  assert.deepEqual(merged.progress.bookmarks, ["server", "guest"]);
  assert.equal(merged.settings.dailyNew, 15);
  assert.ok(sameSnapshot({ n: 2, ok: 1 }, { ok: 1, n: 2 }));
});
