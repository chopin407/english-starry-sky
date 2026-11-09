const { bookOf, wordsOf, open } = require("../lib/library");
const progress = require("../lib/progress");
const { wordMedia } = require("../lib/media");

Page({
  onShow() {
    const { book, goal } = progress.get();
    const { due, fresh, studied } = progress.plan();
    this.setData({
      book: bookOf(book).name, goal, due: due.length, fresh: fresh.length, studied,
      canDictate: wordsOf(book).some((w) => wordMedia({ ...w, book }, "uk") || wordMedia({ ...w, book }, "us")),
    });
  },
  start(e) { open("pages/study", { mode: e.currentTarget.dataset.mode }); },
  reading() { open("reading/index"); },
  chooseBook() { wx.switchTab({ url: "/pages/books" }); },
});
