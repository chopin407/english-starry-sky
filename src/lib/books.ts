import { store } from "../store/store";
import { BOOKS, bookById } from "./bookCatalog";
export * from "./bookCatalog";

/** 新同学第一次进来时预选哪一册：9 月到次年 1 月是上学期，2 月到 8 月是下学期 */
export function suggestBook(now = new Date()): string {
  const m = now.getMonth() + 1;
  const term = m >= 9 || m === 1 ? "a" : "b";
  const ready = BOOKS.filter((b) => b.ready);
  return (ready.find((b) => b.term === term) ?? ready[0] ?? BOOKS[0]).id;
}

/** 「人教版八年级上册」：分享图片、页脚上显示当前选的册 */
export const bookTag = (id = store.get().settings.book) => {
  const book = bookById(id);
  return `${book.edition ?? "人教版"}${book.name}`;
};
