import type { Progress, Settings } from "../store/store";
import { practiceReviewedAt, type PracticeReview } from "../store/practiceReview";

export type LanSnapshot = {
  app: "word-atlas";
  version: 2;
  progress: Progress;
  settings: Settings;
  qa: unknown;
};

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const at = (v: unknown, key: string) => record(v) && Object.hasOwn(v, key) ? v[key] : undefined;
const number = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : 0;

export function sameSnapshot(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => sameSnapshot(v, b[i]));
  if (!record(a) || !record(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && sameSnapshot(a[key], b[key]));
}

const keys = (...maps: unknown[]) => new Set(maps.flatMap((map) => record(map) ? Object.keys(map) : []));
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const index = (value: unknown, key: (item: unknown) => unknown) => new Map(array(value).map((item) => [key(item), item]));
const addChanges = (base: unknown, local: unknown, remote: unknown, shared: boolean) =>
  shared ? Math.max(0, number(local) + number(remote) - number(base)) : Math.max(number(local), number(remote));

/** Rebase the browser's edits since its last confirmed server snapshot. */
export function mergeLanSnapshots(base: LanSnapshot | null, local: LanSnapshot, remote: LanSnapshot): LanSnapshot {
  function merge(before: unknown, mine: unknown, theirs: unknown, path: string[]): unknown {
    if (sameSnapshot(mine, before)) return theirs;
    if (sameSnapshot(theirs, before)) return mine;
    const [top, group] = path;
    const last = path.at(-1);
    if (top === "qa" && path.length === 2 && record(mine) && record(theirs)) {
      const latest = number(mine.at) >= number(theirs.at) ? mine : theirs;
      return { ...latest, n: addChanges(at(before, "n"), mine.n, theirs.n, !!base),
        ok: addChanges(at(before, "ok"), mine.ok, theirs.ok, !!base) };
    }
    if (top === "progress") {
      if (group === "days" && path.length === 4) return addChanges(before, mine, theirs, !!base);
      if (group === "game" && (last === "shards" || last === "patches")) return addChanges(before, mine, theirs, !!base);
      if (group === "cards" && path.length === 3 && record(mine) && record(theirs)) {
        const latest = number(mine.last) >= number(theirs.last) ? mine : theirs;
        return { ...latest, reps: addChanges(at(before, "reps"), mine.reps, theirs.reps, !!base),
          lapses: addChanges(at(before, "lapses"), mine.lapses, theirs.lapses, !!base),
          seen: addChanges(at(before, "seen"), mine.seen, theirs.seen, !!base) };
      }
      if (group === "practiceReviews" && path.length === 3) {
        // A newly recorded wrong answer remains due even if another device just finished the old review.
        if (!mine || !theirs) return mine ?? theirs;
        return practiceReviewedAt(mine as PracticeReview) >= practiceReviewedAt(theirs as PracticeReview) ? mine : theirs;
      }
      if (group === "reading" && path.length === 3 && record(mine) && record(theirs)) {
        return number(mine.at) <= number(theirs.at) ? mine : theirs;
      }
    }
    if (Array.isArray(mine) && Array.isArray(theirs)) {
      if (group === "game" && last === "unitDays") {
        const dates = new Set([...mine, ...theirs]);
        const count = (items: unknown[], day: unknown) => items.filter((v) => v === day).length;
        return [...dates].flatMap((day) => Array(addChanges(count(array(before), day), count(mine, day), count(theirs, day), !!base)).fill(day));
      }
      const key = (item: unknown) => {
        if (group === "typing") return JSON.stringify(["at", "mode", "items", "wpm", "accuracy"].map((field) => at(item, field)));
        return last === "coupons" ? at(item, "id") : item;
      };
      const old = index(before, key);
      const left = index(mine, key);
      const right = index(theirs, key);
      const combined = [...new Set([...right.keys(), ...left.keys()])]
        .map((id) => merge(old.get(id), left.get(id), right.get(id), [...path, String(id)]))
        .filter((item) => item !== undefined);
      return group === "typing" ? combined.sort((a, b) => number(at(a, "at")) - number(at(b, "at"))) : combined;
    }
    if (record(mine) && record(theirs)) {
      return Object.fromEntries([...keys(mine, theirs)].flatMap((key) => {
        const value = merge(at(before, key), at(mine, key), at(theirs, key), [...path, key]);
        return value === undefined ? [] : [[key, value]];
      }));
    }
    return mine;
  }

  return {
    app: "word-atlas",
    version: 2,
    progress: merge(base?.progress, local.progress, remote.progress, ["progress"]) as Progress,
    settings: base ? merge(base.settings, local.settings, remote.settings, ["settings"]) as Settings : remote.settings,
    qa: merge(base?.qa, local.qa, remote.qa, ["qa"]),
  };
}
