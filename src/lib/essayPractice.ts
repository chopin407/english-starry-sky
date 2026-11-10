import { clean, gradeDictation } from "./typing";

type Format = "cap" | "punct";
type Part = { text: string; mark?: "difference" | Format };
type EssayGrade = { correct: boolean; total: number; matched: number; formats: Format[]; draft: Part[]; reference: Part[] };

function words(text: string) {
  const tokens: { word: string; key: string; index: number }[] = [];
  const pattern = /\S+/gu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const word = match[0];
    const key = clean(word).replace(/\p{P}/gu, "").toLowerCase();
    if (key) tokens.push({ word, key, index: match.index });
  }
  return tokens;
}

export const essayDraftLimit = (reference: string) => Math.max(2000, reference.length * 3);

export function essayOpenings(paragraphs: string[]) {
  return paragraphs.map((paragraph) => paragraph.trim().split(/\s+/).slice(0, 3).join(" "));
}

function markDifferences(text: string, tokens: ReturnType<typeof words>, matched: Set<number>): Part[] {
  const parts: Part[] = [];
  let from = 0;
  tokens.forEach(({ word, index }, i) => {
    if (matched.has(i)) return;
    if (from < index) parts.push({ text: text.slice(from, index) });
    parts.push({ text: word, mark: "difference" });
    from = index + word.length;
  });
  if (from < text.length) parts.push({ text: text.slice(from) });
  return parts;
}

/** Align words in order so one omission doesn't mark the rest of the draft wrong. */
export function gradeEssay(draft: string, reference: string): EssayGrade {
  const submitted = draft.slice(0, essayDraftLimit(reference));
  const verdict = gradeDictation(submitted, reference, true);
  const expected = words(reference);
  if (verdict.correct) {
    return {
      correct: true,
      total: expected.length,
      matched: expected.length,
      formats: verdict.format?.kinds ?? [],
      draft: verdict.format?.submitted.map(({ text, kind }) => ({ text, mark: kind })) ?? [{ text: submitted }],
      reference: verdict.format?.reference.map(({ text, kind }) => ({ text, mark: kind })) ?? [{ text: reference }],
    };
  }

  const actual = words(submitted);
  const width = actual.length + 1;
  const scores = new Uint16Array((expected.length + 1) * width);
  for (let i = expected.length - 1; i >= 0; i--) {
    for (let j = actual.length - 1; j >= 0; j--) {
      const cell = i * width + j;
      scores[cell] = expected[i].key === actual[j].key
        ? scores[cell + width + 1] + 1
        : Math.max(scores[cell + width], scores[cell + 1]);
    }
  }
  const referenceMatches = new Set<number>();
  const draftMatches = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < expected.length && j < actual.length) {
    if (expected[i].key === actual[j].key) {
      referenceMatches.add(i++);
      draftMatches.add(j++);
    } else if (scores[(i + 1) * width + j] >= scores[i * width + j + 1]) i++;
    else j++;
  }
  return {
    correct: false,
    total: expected.length,
    matched: referenceMatches.size,
    formats: [],
    draft: markDifferences(submitted, actual, draftMatches),
    reference: markDifferences(reference, expected, referenceMatches),
  };
}
