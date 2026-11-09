const { wordOf } = require("../lib/library");
const progress = require("../lib/progress");
const { wordMedia, playAudio, stopAudio } = require("../lib/media");

Page({
  onLoad({ book, id }) {
    const entry = wordOf(book, id);
    if (!entry) return;
    this.word = { ...entry, book };
    const image = wordMedia(this.word, "img");
    this.audio = Object.fromEntries(["uk", "us", "ex", "ex2"].map((k) => [k, wordMedia(this.word, k)]));
    this.setData({
      word: this.word, image, audio: this.audio,
      examples: entry.ex.map((ex, i) => ({ ...ex, audio: i === 0 ? "ex" : "ex2" })),
      saved: Boolean(progress.get().saved[id]),
    });
    wx.setNavigationBarTitle({ title: entry.w });
  },
  imageError() { this.setData({ image: "" }); },
  play(e) { playAudio(this.audio[e.currentTarget.dataset.kind]); },
  save() { this.setData({ saved: progress.toggleSaved(this.word) }); },
  onHide: stopAudio,
  onUnload: stopAudio,
});
