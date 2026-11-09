const { bookOf, open } = require("../lib/library");
const progress = require("../lib/progress");
const { version } = require("../_generated/content");

Page({
  data: { goals: [5, 10, 15, 20, 30], version },
  onShow() {
    const { book, goal, days, saved, mistakes, reading } = progress.get();
    this.setData({
      book: bookOf(book).name, goal, stats: progress.stats(book),
      days: Object.keys(days).length, saved: Object.keys(saved).length,
      mistakes: Object.keys(mistakes).length, reading: Object.keys(reading).length,
    });
  },
  goal(e) {
    const goal = this.data.goals[Number(e.detail.value)];
    if (goal) progress.set({ goal });
    this.onShow();
  },
  saved(e) { open("pages/saved", { mode: e.currentTarget.dataset.mode }); },
});
