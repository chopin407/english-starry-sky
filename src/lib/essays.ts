export interface Essay {
  id: string;
  title: string;
  englishTitle: string;
  topic: string;
  summary: string;
  versions: { label: string; paragraphs: string[] }[];
  outline: string[];
  grammar: { title: string; example: string; translation: string; explanation: string; tip: string }[];
  vocabulary: { term: string; meaning: string; usage: string }[];
}

export const essaysByBook = import.meta.glob<Essay[]>("../data/essays/*.ts", {
  eager: true,
  import: "default",
});
