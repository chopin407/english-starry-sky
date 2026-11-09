export interface Book {
  id: string;
  name: string;
  edition?: string;
  /** 简称：搜索结果、标签上用 */
  short: string;
  /** 上册 / 下册 / 全册：按日期给新同学预选时用 */
  term: "a" | "b" | "all";
  ready: boolean;
}

export const BOOKS: Book[] = [
  { id: "6a", name: "六年级上册", short: "六上", term: "a", ready: true },
  { id: "7a", name: "七年级上册", short: "七上", term: "a", ready: true },
  { id: "7b", name: "七年级下册", short: "七下", term: "b", ready: true },
  { id: "8a", name: "八年级上册", short: "八上", term: "a", ready: true },
  { id: "8b", name: "八年级下册", short: "八下", term: "b", ready: true },
  { id: "9", name: "九年级", short: "九年级", term: "all", ready: true },
  { id: "fltrp9a", name: "九年级", edition: "外研版", short: "外研九", term: "a", ready: true },
];

/** 中考总复习：三年内容按中考考法重新组织，只放在左上角菜单里，不进新手引导（以后单独设计） */
export const ZK_BOOK: Book = { id: "zk", name: "中考总复习", short: "中考", term: "all", ready: false };

export const bookById = (id: string) => [...BOOKS, ZK_BOOK].find((b) => b.id === id) ?? BOOKS[0];
