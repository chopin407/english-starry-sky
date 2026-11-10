import type { Atlas, WordRef } from "../atlas/types";
import { MEDIA } from "../atlas/types";
import { hashSeed, normalize, shuffle } from "../lib/text";
import { forgetResolvedWord } from "./practiceReview";
import { dueCardIds } from "./due";
import { isMastered, review, Rating, type Grade } from "./srs";
import { bumpDay, dayKey, store, type ActiveSession, type JourneyPilot, type Progress, type QuizKind, type Settings, type Step } from "./store";

export function dueIds(p: Progress, now = Date.now()) {
  return dueCardIds(p.cards, now);
}

export function newToday(p: Progress) {
  return p.days[dayKey()]?.n ?? 0;
}

/** Next unseen words along the learning path, starting at the learner's level. */
export function nextNew(atlas: Atlas, p: Progress, settings: Settings, count: number) {
  const out: string[] = [];
  const pass = (from: number) => {
    for (const w of atlas.words) {
      if (out.length >= count) return;
      if (w.cefr < from || p.cards[w.id] || out.includes(w.id)) continue;
      out.push(w.id);
    }
  };
  pass(settings.startLevel);
  if (out.length < count) pass(0);
  return out;
}

export function todayPlan(atlas: Atlas, p: Progress, s: Settings) {
  const due = dueIds(p).filter((id) => atlas.byId.has(id));
  const newLeft = Math.max(0, s.dailyNew - newToday(p));
  const fresh = nextNew(atlas, p, s, newLeft);
  return { due, fresh, minutes: Math.max(1, Math.round(due.length * 0.25 + fresh.length * 0.9)) };
}

export const supportsJourneyPilot = (atlas: Atlas) => atlas.kind === "open" && (atlas.book === "6a" || atlas.book === "7a");

export function pilotPlan(atlas: Atlas, plan: ReturnType<typeof todayPlan>, pilot: JourneyPilot) {
  const [reviews, fresh] = pilot === "warmup" ? [4, 1] : [8, 3];
  const due = plan.due.filter((id) => {
    const ref = atlas.byId.get(id);
    return ref && atlas.words[ref.order]?.id === id;
  });
  return { due: due.slice(0, reviews), fresh: plan.fresh.slice(0, fresh) };
}

const sessionKey = (atlas: Atlas) => atlas.book ?? atlas.id;

function legacySessionKey(atlas: Atlas, session: ActiveSession) {
  const ids = session.newIds.length ? session.newIds : session.reviewIds;
  const ownsWords = (book: Atlas) => ids.every((id) => {
    const ref = book.byId.get(id);
    return ref && book.words[ref.order]?.id === id;
  });
  const owner = ownsWords(atlas) ? atlas : atlas.shelf?.find(ownsWords);
  return owner ? sessionKey(owner) : !session.newIds.length && ids.every((id) => atlas.byId.has(id)) ? sessionKey(atlas) : undefined;
}

export function sessionFor(atlas: Atlas, progress: Progress): ActiveSession | null {
  const key = sessionKey(atlas);
  if (progress.sessions && Object.hasOwn(progress.sessions, key)) return progress.sessions[key];
  const old = progress.session;
  return old && legacySessionKey(atlas, old) === key ? old : null;
}

export function withSession(atlas: Atlas, progress: Progress, session: ActiveSession | null): Progress {
  const key = sessionKey(atlas);
  const old = progress.session;
  const oldKey = old && legacySessionKey(atlas, old);
  const sessions = {
    ...(old && oldKey ? { [oldKey]: old } : {}),
    ...progress.sessions,
    ...(session ? { [key]: session } : {}),
  };
  if (!session) delete sessions[key];
  return { ...progress, session: oldKey ? null : old, sessions };
}

function quizKind(ref: WordRef, p: Progress, s: Settings, salt: number): QuizKind {
  const c = p.cards[ref.id];
  const hasImg = !!(ref.media & MEDIA.img);
  const roll = hashSeed(ref.id + salt) % 100;
  if (!c || c.s < 2) {
    if (hasImg && roll < 45) return "picture";
    return roll < 80 ? "meaning" : "listen";
  }
  if (s.spell && (c.s >= 4 || roll < 35)) return roll < 75 ? "spell" : hasImg ? "picture" : "listen";
  return roll < 50 ? "listen" : hasImg ? "picture" : "meaning";
}

/** Distractors that look plausible: same level, similar spelling or length, different meaning. */
export function distractors(atlas: Atlas, ref: WordRef, kind: QuizKind, seed: number) {
  const target = normalize(ref.word);
  const zhCore = ref.zh.replace(/^[a-z.]+\s*/, "").split(/[；;，,]/)[0];
  const scored: [number, WordRef][] = [];
  const pool = atlas.words;
  const start = Math.max(0, ref.order - 400);
  for (let i = start; i < Math.min(pool.length, ref.order + 400); i++) {
    const w = pool[i];
    if (w.id === ref.id || normalize(w.word) === target) continue;
    if (zhCore && w.zh.includes(zhCore)) continue;
    let score = hashSeed(w.id + seed) % 100;
    if (kind === "listen" || kind === "picture") {
      if (w.word[0]?.toLowerCase() === target[0]) score += 120;
      score += Math.max(0, 60 - Math.abs(w.word.length - target.length) * 20);
    } else {
      if (w.cefr === ref.cefr) score += 40;
      if (w.zh.split(" ")[0] === ref.zh.split(" ")[0]) score += 60; // same part of speech
    }
    scored.push([score, w]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  const seen = new Set<string>();
  const picks: string[] = [];
  for (const [, w] of scored) {
    const key = kind === "meaning" ? w.zh : normalize(w.word);
    if (seen.has(key)) continue;
    seen.add(key);
    picks.push(w.id);
    if (picks.length === 3) break;
  }
  return shuffle([ref.id, ...picks], seed);
}

export function buildSession(atlas: Atlas, p: Progress, s: Settings, opts?: { ids?: string[]; reviewOnly?: boolean; pilot?: JourneyPilot }): ActiveSession {
  const seed = Date.now();
  const pilot = !opts?.ids && supportsJourneyPilot(atlas) ? opts?.pilot : undefined;
  const daily = todayPlan(atlas, p, s);
  const plan = pilot ? pilotPlan(atlas, daily, pilot) : daily;
  const reviewIds = opts?.ids ? opts.ids.filter((id) => p.cards[id]) : plan.due.slice(0, 120);
  const newIds = opts?.ids ? opts.ids.filter((id) => !p.cards[id]) : opts?.reviewOnly ? [] : plan.fresh;
  const steps: Step[] = [];
  const quiz = (id: string, salt: number): Step => {
    const ref = atlas.byId.get(id)!;
    const kind = quizKind(ref, p, s, seed + salt);
    return { id, kind, options: kind === "spell" ? undefined : distractors(atlas, ref, kind, seed + salt) };
  };
  // Reviews first while attention is fresh, then new words in small groups:
  // meet five, then recall those five in a different order.
  reviewIds.forEach((id, i) => steps.push(quiz(id, i)));
  for (let g = 0; g < newIds.length; g += 5) {
    const group = newIds.slice(g, g + 5);
    group.forEach((id) => steps.push({ id, kind: "intro" }));
    shuffle(group, seed + g).forEach((id, i) => steps.push(quiz(id, 1000 + g + i)));
  }
  return { id: `s${seed}`, started: seed, steps, index: 0, graded: {}, newIds, reviewIds, ...(pilot ? { pilot } : {}) };
}

export function gradeFor(kind: QuizKind, correct: boolean, ms: number, hinted: boolean): Grade {
  if (!correct) return Rating.Again;
  if (hinted) return Rating.Hard;
  const slow = kind === "spell" ? 20000 : 9000;
  const fast = kind === "spell" ? 6000 : 2500;
  if (ms > slow) return Rating.Hard;
  if (ms < fast && kind === "spell") return Rating.Easy;
  return Rating.Good;
}

/** Apply an answer. Only the first attempt for a word in a session updates memory and stats. */
export function answer(atlas: Atlas, step: Step & { kind: QuizKind }, correct: boolean, grade: Grade, value: string, usedHint = false) {
  const { settings } = store.get();
  store.progress((p) => applyJourneyAnswer(atlas, p, settings, step, { correct, grade, value, usedHint }));
}

export function applyJourneyAnswer(atlas: Atlas, p: Progress, settings: Settings, step: Step & { kind: QuizKind },
  { correct, grade, value, usedHint }: { correct: boolean; grade: Grade; value: string; usedHint: boolean }, now = Date.now()) {
  const sess = sessionFor(atlas, p);
  if (!sess || sess.pending) return p;
  let next = p;
  let updated: ActiveSession = { ...sess, pending: { correct, value } };
  const first = !(step.id in sess.graded) && !step.retry;
  if (first) {
    next = {
      ...next,
      cards: { ...next.cards, [step.id]: review(p.cards[step.id], grade, now, settings.retention) },
      mistakes: correct ? next.mistakes : [step.id, ...next.mistakes.filter((x) => x !== step.id)].slice(0, 300),
    };
    updated = { ...updated, graded: { ...sess.graded, [step.id]: grade } };
    if (sess.pilot && usedHint && correct) updated.firstHinted = [...(sess.firstHinted ?? []), step.id];
    next = bumpDay(next, { r: 1, c: correct ? 1 : 0, n: sess.newIds.includes(step.id) ? 1 : 0 });
  }

  const guidedChoice = step.guided && step.kind !== "spell";
  const independent = correct && !usedHint && !guidedChoice;
  if (sess.pilot && independent && step.retry && (sess.graded[step.id] === Rating.Again || sess.firstHinted?.includes(step.id))) {
    updated.recovered = [...new Set([...(sess.recovered ?? []), step.id])];
  }
  if (!correct || (sess.pilot && (usedHint || guidedChoice))) {
    const retries = sess.steps.filter((item) => item.id === step.id && item.kind !== "intro" && item.retry).length;
    // A guided multiple-choice attempt is followed by one unaided check.
    if (retries < 2 || (sess.pilot && guidedChoice && retries === 2)) {
      const ref = atlas.byId.get(step.id)!;
      const canSpell = settings.spell && /\p{L}.*\p{L}/u.test(ref.word);
      const kind: QuizKind = sess.pilot
        ? canSpell ? "spell" : "listen"
        : step.kind === "meaning" ? (ref.media & MEDIA.img ? "picture" : "listen") : "meaning";
      const guided = !!sess.pilot && kind !== "spell" && !correct && retries === 1;
      let options = kind === "spell" ? undefined : distractors(atlas, ref, kind, now);
      if (guided && options) {
        const alternative = options.find((id) => id !== ref.id);
        options = options.filter((id) => id === ref.id || id === alternative);
      }
      const steps = [...sess.steps];
      steps.splice(sess.index + 4, 0, { id: step.id, kind, retry: true, ...(guided ? { guided } : {}), options });
      updated = { ...updated, steps };
    }
  }
  if (sess.pilot ? independent : correct) next = { ...next, mistakes: forgetResolvedWord(next.mistakes, next.practiceReviews, step.id) };
  return withSession(atlas, next, updated);
}

/** Move to the next step; `seconds` is time spent on this step, capped so idle tabs don't inflate stats. */
export function advance(atlas: Atlas, seconds: number) {
  store.progress((p) => {
    const s = sessionFor(atlas, p);
    if (!s) return p;
    const index = s.index + 1;
    const finished = index >= s.steps.length ? Date.now() : undefined;
    const next = bumpDay(p, { t: Math.max(0, Math.min(90, Math.round(seconds))) });
    return withSession(atlas, next, { ...s, index, pending: undefined, finished });
  });
}

export function sessionStats(s: ActiveSession) {
  const graded = Object.values(s.graded);
  const correct = graded.filter((g) => g !== Rating.Again).length;
  return { total: graded.length, correct, accuracy: graded.length ? Math.round((correct / graded.length) * 100) : 0 };
}

export function journeyProgress(s: ActiveSession) {
  return {
    reviewCorrect: s.reviewIds.filter((id) => s.graded[id] && s.graded[id] !== Rating.Again && !s.firstHinted?.includes(id)).length,
    recovered: s.recovered ?? [],
  };
}

export const masteredCount = (p: Progress) => Object.values(p.cards).filter(isMastered).length;
