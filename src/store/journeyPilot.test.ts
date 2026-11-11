import assert from "node:assert/strict";
import { test } from "node:test";
import type { Atlas, WordRef } from "../atlas/types";
import { EXTENSION_UNIT } from "../lib/unit";
import { applyJourneyAnswer, buildSession, journeyProgress, sessionFor, shortFollowUp, supportsJourneyPilot, todayPlan, withSession } from "./session";
import { Rating, review } from "./srs";
import { defaultSettings, emptyProgress, sanitizeProgress, type ActiveSession, type QuizKind, type Step } from "./store";

const word = (id: string, order: number): WordRef => ({ id, word: id, zh: id, ipa: "", cefr: 0, topic: 0, media: 0, order });
const makeAtlas = (book: string) => {
  const words = Array.from({ length: 15 }, (_, i) => word(`word-${i}`, i));
  const shared = word("other-book", 0);
  return { id: book, book, kind: "open", cefr: ["Starter Unit 1"], words, byId: new Map([...words, shared].map((ref) => [ref.id, ref])) } as Atlas;
};

test("the pilot takes bounded groups from six and seven A while leaving full sessions available", () => {
  const p = emptyProgress("pep-7a");
  for (const id of [...Array.from({ length: 10 }, (_, i) => `word-${i}`), "other-book"]) {
    p.cards[id] = review(undefined, Rating.Good, 0);
  }
  for (const book of ["6a", "7a"]) {
    const atlas = makeAtlas(book);
    const short = buildSession(atlas, p, defaultSettings, { pilot: "short" });
    assert.equal(short.pilot, "short");
    assert.equal(short.reviewIds.length, 8);
    assert.equal(short.newIds.length, 3);
    assert.ok(short.reviewIds.every((id) => id !== "other-book"));
    const warmup = buildSession(atlas, p, defaultSettings, { pilot: "warmup" });
    assert.equal(warmup.reviewIds.length, 4);
    assert.equal(warmup.newIds.length, 1);
    assert.equal(buildSession(atlas, p, defaultSettings).reviewIds.length, 11);
  }
  const excluded = makeAtlas("7b");
  assert.equal(supportsJourneyPilot(excluded), false);
  assert.equal(buildSession(excluded, p, defaultSettings, { pilot: "short" }).pilot, undefined);
});

test("7a daily and short journeys introduce unseen extension vocabulary within the new-word quota", () => {
  const atlas = makeAtlas("7a");
  atlas.cefr.push(EXTENSION_UNIT);
  atlas.words[13].cefr = atlas.words[14].cefr = 1;
  const p = emptyProgress("pep-7a");
  const settings = { ...defaultSettings, dailyNew: 5 };

  assert.deepEqual(todayPlan(atlas, p, settings).fresh, ["word-0", "word-13", "word-1", "word-2", "word-3"]);
  assert.deepEqual(buildSession(atlas, p, settings, { pilot: "short" }).newIds, ["word-0", "word-13", "word-1"]);
  assert.deepEqual(buildSession(atlas, p, settings, { pilot: "warmup" }).newIds, ["word-0"]);
  p.cards["word-13"] = review(undefined, Rating.Good, 0);
  assert.deepEqual(buildSession(atlas, p, settings, { pilot: "short" }).newIds, ["word-0", "word-14", "word-1"]);
  p.cards["word-14"] = review(undefined, Rating.Good, 0);
  assert.deepEqual(buildSession(atlas, p, settings, { pilot: "short" }).newIds, ["word-0", "word-1", "word-2"]);
});

test("six and seven A can start the next short task with different due words and remaining new words", () => {
  for (const book of ["6a", "7a"]) {
    const atlas = makeAtlas(book);
    const p = emptyProgress("pep-7a");
    p.cards["word-0"] = review(undefined, Rating.Again, 0);
    const first = buildSession(atlas, p, defaultSettings, { pilot: "short" });
    const completed = { ...first, index: first.steps.length, finished: Date.now() };
    for (const id of first.newIds) p.cards[id] = review(undefined, Rating.Good, Date.now());
    p.cards["word-4"] = review(undefined, Rating.Again, 0);

    const followUp = shortFollowUp(atlas, p, defaultSettings, completed);
    assert.equal(followUp?.kind, "short");
    const next = buildSession(atlas, p, defaultSettings, followUp?.options);
    assert.equal(next.pilot, "short");
    assert.deepEqual(next.reviewIds, ["word-4"]);
    assert.ok(next.newIds.length > 0 && next.newIds.every((id) => !completed.newIds.includes(id)));
  }
});

test("when the daily queue is exhausted the next activity reinforces learned words once", () => {
  const atlas = makeAtlas("7a");
  const p = emptyProgress("pep-7a");
  const settings = { ...defaultSettings, dailyNew: 0 };
  p.cards["word-0"] = review(undefined, Rating.Good, 0);
  p.cards["word-1"] = review(undefined, Rating.Again, 0);
  const first = buildSession(atlas, p, settings, { pilot: "short" });
  const completed: ActiveSession = {
    ...first, index: first.steps.length, finished: Date.now(),
    graded: { "word-0": Rating.Good, "word-1": Rating.Again },
  };
  const followUp = shortFollowUp(atlas, p, settings, completed);
  assert.equal(followUp?.kind, "reinforce");
  const next = buildSession(atlas, p, settings, followUp?.options);
  assert.deepEqual(next.reviewIds, ["word-1", "word-0"]);
  assert.deepEqual(next.newIds, []);
  assert.equal(shortFollowUp(atlas, p, settings, next), null);
});

test("two spelling misses lead to one plain retry that can count as independent", () => {
  const atlas = makeAtlas("7a");
  const id = atlas.words[0].id;
  const initial: ActiveSession = {
    id: "pilot", started: 1000, steps: atlas.words.slice(0, 9).map(({ id }) => ({ id, kind: "spell" })),
    index: 0, graded: {}, newIds: [], reviewIds: [id], pilot: "short",
  };
  let p = withSession(atlas, emptyProgress("pep-7a"), initial);
  const attempt = (index: number, correct: boolean, usedHint = false) => {
    const s = { ...sessionFor(atlas, p)!, index, pending: undefined };
    p = withSession(atlas, p, s);
    const step = s.steps[index] as Step & { kind: QuizKind };
    p = applyJourneyAnswer(atlas, p, defaultSettings, step, {
      correct, usedHint, value: "", grade: correct ? Rating.Good : Rating.Again,
    }, 1000);
    return sessionFor(atlas, p)!;
  };
  let s = attempt(0, false);
  assert.deepEqual(s.steps[4], { id, kind: "spell", retry: true, options: undefined });
  s = attempt(4, false);
  assert.deepEqual(s.steps[8], { id, kind: "spell", retry: true, options: undefined });
  p = sanitizeProgress(JSON.parse(JSON.stringify(p)), "pep-7a");
  s = attempt(8, true);
  assert.equal(s.steps.length, 11);
  assert.deepEqual(journeyProgress(s), { reviewCorrect: 0, recovered: [id] });
  assert.equal(s.graded[id], Rating.Again);
  assert.deepEqual(p.mistakes, []);
  assert.equal(Object.values(p.days)[0].r, 1);
});

test("a first answer with help gets a later independent check without being counted as unaided", () => {
  const atlas = makeAtlas("6a");
  const step = { id: atlas.words[0].id, kind: "spell" } as const;
  const initial: ActiveSession = {
    id: "pilot", started: 1000, steps: [step], index: 0, graded: {}, newIds: [], reviewIds: [step.id], pilot: "warmup",
  };
  const p = withSession(atlas, emptyProgress("pep-7a"), initial);
  const next = applyJourneyAnswer(atlas, p, defaultSettings, step, { correct: true, grade: Rating.Hard, usedHint: true, value: step.id }, 1000);
  const s = sessionFor(atlas, next)!;
  assert.equal(s.steps.length, 2);
  assert.equal(journeyProgress(s).reviewCorrect, 0);
  assert.equal(applyJourneyAnswer(atlas, next, defaultSettings, step, { correct: true, grade: Rating.Hard, usedHint: true, value: step.id }), next);
});
