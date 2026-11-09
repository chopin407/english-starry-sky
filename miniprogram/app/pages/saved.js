const { wordOf, bookOf, open } = require("../lib/library");
const progress = require("../lib/progress");

Page({
  onLoad(params) { this.mode = params.mode === "mistakes" ? "mistakes" : "saved"; },
  onShow() {
    const title = this.mode === "saved" ? "我的收藏" : "错词本";
    wx.setNavigationBarTitle({ title });
    const words = Object.entries(progress.get()[this.mode]).map(([id, book]) => {
      const word = wordOf(book, id);
      return word && { id, book, name: bookOf(book).short, w: word.w, zh: word.zh };
    }).filter(Boolean);
    this.setData({ words, title, mistakes: this.mode === "mistakes" });
  },
  detail(e) { open("pages/word", e.currentTarget.dataset); },
  retry() { open("pages/study", { mode: "mistakes" }); },
});
