export type PracticeMode = "word" | "dictation" | "sentence";

export interface PracticePrompt {
  id: string;
  mode: PracticeMode;
  book: string;
}

export interface PracticeReview extends PracticePrompt {
  stage: number;
  due: number;
}

// Gaps after a mistake and each successful review, based on the forgetting-curve observation points.
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const INTERVALS = [20 * MINUTE, 60 * MINUTE, 9 * 60 * MINUTE, DAY, 2 * DAY, 6 * DAY, 31 * DAY];

export const practiceKey = ({ id, mode, book }: PracticePrompt) => JSON.stringify([book, id, mode]);

export function updatePracticeReview(reviews: Record<string, PracticeReview>, prompt: PracticePrompt, correct: boolean, now: number) {
  const key = practiceKey(prompt);
  const current = reviews[key];
  if (correct && (!current || current.due > now)) return reviews;

  const stage = correct ? current.stage + 1 : 0;
  const next = { ...reviews };
  if (stage === INTERVALS.length) delete next[key];
  else next[key] = { ...prompt, stage, due: now + INTERVALS[stage] };
  return next;
}

export function validPracticeReview(value: unknown): value is PracticeReview {
  if (!value || typeof value !== "object") return false;
  const { id, mode, book, stage, due } = value as PracticeReview;
  return (
    typeof id === "string" && id.length > 0 &&
    typeof book === "string" &&
    (mode === "word" || mode === "dictation" || mode === "sentence") &&
    Number.isInteger(stage) && stage >= 0 && stage < INTERVALS.length &&
    Number.isSafeInteger(due) && due >= 0 && due <= 8.64e15
  );
}
