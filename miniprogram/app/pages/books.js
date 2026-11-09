const { books, bookOf, open } = require("../lib/library");
const progress = require("../lib/progress");

Page({
  data: { books },
  onShow() { this.refresh(); },
  refresh() {
    const { book } = progress.get();
    this.setData({ book: bookOf(book), bookIndex: books.findIndex((b) => b.id === book) });
  },
  choose(e) {
    const book = books[Number(e.detail.value)];
    if (!book) return;
    progress.set({ book: book.id });
    this.refresh();
  },
  unit(e) { open("textbook/unit", { book: this.data.book.id, unit: e.currentTarget.dataset.id }); },
  essays() { open("textbook/essay", { book: this.data.book.id }); },
});
