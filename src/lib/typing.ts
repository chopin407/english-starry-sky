/** Normalize the typography mobile keyboards commonly substitute. */
export const clean = (text: string) =>
  text
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐‑–—]/g, "-")
    .replace(/\s/g, " ");
export const same = (a: string, b: string) =>
  clean(a).toLowerCase() === clean(b).toLowerCase();

export const SPELL_GAP = "\u2063";

/** Select a letter, creating editable blanks if the learner taps ahead. */
export function spellSlotEdit(value: string, targetWords: string[], wordIndex: number, slotIndex: number) {
  const words = value.split(/\s/);
  for (let i = 0; i < wordIndex; i++) {
    if (i >= words.length - 1) {
      const missing = Array.from(targetWords[i] ?? "").length - Array.from(words[i] ?? "").length;
      words[i] = (words[i] ?? "") + SPELL_GAP.repeat(Math.max(0, missing));
    }
  }
  const letters = Array.from(words[wordIndex] ?? "");
  const prefix = letters.slice(0, slotIndex).join("") + SPELL_GAP.repeat(Math.max(0, slotIndex - letters.length));
  words[wordIndex] = prefix + letters.slice(slotIndex).join("");
  const start = words.slice(0, wordIndex).reduce((sum, word) => sum + word.length + 1, prefix.length);
  return { value: words.join(" "), start, end: start + (letters[slotIndex]?.length ?? 0) };
}

const normalizeDictation = (text: string) => clean(text).trim().replace(/ +/g, " ");

export function dictationWordForms(target: string) {
  const expected = normalizeDictation(target);
  // Headwords can contain textbook annotations, e.g. "grey (AmE gray)" or "depend on / upon".
  const american = expected.match(/\(AmE ([^)]+)\)$/)?.[1].trim();
  if (expected === "a lot of / lots of") return ["a lot of", "lots of", expected];
  const forms = [expected.replace(/ *\([^()]*\)/g, ""), expected.replace(/[()]/g, ""), expected];
  if (american) forms.push(american);
  return [...new Set(forms.flatMap((form) => {
    const choices = form.match(/^(.*?)([^ /]+) *\/ *([^ /]+)(.*)$/);
    if (!choices) return [form];
    const [, prefix, left, right, suffix] = choices;
    return [prefix + left + suffix, prefix + right + suffix, form];
  }).map(normalizeDictation))];
}

type FormatKind = "cap" | "punct";
type DictationPart = { text: string; kind?: FormatKind };
type DictationFormat = { submitted: DictationPart[]; reference: DictationPart[]; kinds: FormatKind[] };
export type DictationGrade = { correct: boolean; format?: DictationFormat };

function compareDictation(submitted: string, expected: string): DictationFormat | null {
  // Align content characters independently of adjacent punctuation.
  const pattern = /([^\p{P} ])/u;
  const actual = submitted.split(pattern);
  const reference = expected.split(pattern);
  if (actual.length !== reference.length) return null;

  const format: DictationFormat = { submitted: [], reference: [], kinds: [] };
  const kinds = new Set<FormatKind>();
  for (let i = 0; i < actual.length; i += 2) {
    const actualGap = actual[i];
    const referenceGap = reference[i];
    const actualChar = actual[i + 1] ?? "";
    const referenceChar = reference[i + 1] ?? "";
    if (actualChar.toLowerCase() !== referenceChar.toLowerCase()) return null;
    const actualPunct = /\p{P}/u.test(actualGap);
    const referencePunct = /\p{P}/u.test(referenceGap);
    // Preserve plain word boundaries, e.g. "alot" is still different from "a lot".
    if (!actualPunct && !referencePunct && actualGap !== referenceGap) return null;
    const punct = actualGap !== referenceGap;
    const cap = actualChar !== referenceChar;
    if (cap) kinds.add("cap");
    if (punct) kinds.add("punct");
    if (actualGap) format.submitted.push({ text: actualGap, kind: punct && actualPunct ? "punct" : undefined });
    if (referenceGap) format.reference.push({ text: referenceGap, kind: punct && referencePunct ? "punct" : undefined });
    if (actualChar) format.submitted.push({ text: actualChar, kind: cap ? "cap" : undefined });
    if (referenceChar) format.reference.push({ text: referenceChar, kind: cap ? "cap" : undefined });
  }
  format.kinds = [...kinds];
  return format;
}

export function gradeDictation(value: string, target: string, sentence: boolean): DictationGrade {
  const submitted = normalizeDictation(value);
  if (!submitted || !/[^\p{P} ]/u.test(submitted)) return { correct: false };
  const forms = sentence ? [normalizeDictation(target)] : dictationWordForms(target);
  if (forms.includes(submitted)) return { correct: true };
  let best: DictationFormat | undefined;
  for (const expected of forms) {
    const format = compareDictation(submitted, expected);
    if (!format) continue;
    if (!best || format.kinds.length < best.kinds.length) best = format;
  }
  return best ? { correct: true, format: best } : { correct: false };
}

/** Use normalized Unicode code points consistently for scoring and highlighting. */
export function correctCharacterCount(value: string, target: string) {
  const expected = Array.from(clean(target));
  return Array.from(clean(value)).filter((char, index) =>
    same(char, expected[index] || ""),
  ).length;
}

/** Count newly inserted characters, including replacements, without rewarding deletions. */
export function typingDelta(previous: string, next: string, target: string) {
  const before = Array.from(clean(previous));
  const after = Array.from(clean(next));
  const expected = Array.from(clean(target));
  let prefix = 0;
  while (
    prefix < before.length &&
    prefix < after.length &&
    before[prefix] === after[prefix]
  ) prefix++;
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) suffix++;
  const added = after.slice(prefix, after.length - suffix);
  let correct = 0;
  for (let i = 0; i < added.length; i++) {
    if (same(added[i], expected[prefix + i] || "")) correct++;
  }
  return { total: added.length, correct };
}

/** Standard WPM uses 5 characters per word, not the number of vocabulary cards. */
export function typingMetrics(
  correctCharacters: number,
  attemptedCharacters: number,
  acceptedCharacters: number,
  elapsedMs: number,
) {
  const finiteNonnegative = (n: number) => Number.isFinite(n) ? Math.max(0, n) : 0;
  const attempted = finiteNonnegative(attemptedCharacters);
  const correct = Math.min(finiteNonnegative(correctCharacters), attempted);
  const accepted = finiteNonnegative(acceptedCharacters);
  const duration = finiteNonnegative(elapsedMs);
  return {
    accuracy: attempted ? Math.round((correct / attempted) * 100) : 100,
    wpm: duration >= 1000 ? Math.round(accepted / 5 / (duration / 60000)) : 0,
  };
}
