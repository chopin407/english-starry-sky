const { bookOf, wordsOf, wordOf, shuffle } = require("../lib/library");
const progress = require("../lib/progress");
const { preview, formatInterval, gradeDictation } = require("../_generated/learning");
const { wordMedia, playAudio, stopAudio } = require("../lib/media");

const modes = { daily: "今日学习", choice: "选词义", spell: "看义拼写", audio: "单词听写", mistakes: "错词重练" };
const sound = (w) => wordMedia(w, "uk") || wordMedia(w, "us");
const ratings = [["重来", 1], ["困难", 2], ["记得", 3], ["轻松", 4]];
const batch = 10;

Page({
  data: { index: 0, correctCount: 0 },
  onLoad({ mode }) {
    mode = Object.prototype.hasOwnProperty.call(modes, mode) ? mode : "daily";
    const { book, mistakes } = progress.get();
    this.words = wordsOf(book).map((w) => ({ ...w, book }));
    if (mode === "daily") {
      const { due, fresh } = progress.plan();
      this.queue = [...due, ...fresh].slice(0, batch);
    } else if (mode === "mistakes") {
      this.queue = Object.entries(mistakes).map(([id, owner]) => {
        const w = wordOf(owner, id);
        return w && { ...w, book: owner };
      }).filter(Boolean).slice(0, batch);
    } else {
      this.queue = shuffle(mode === "audio" ? this.words.filter(sound) : this.words).slice(0, batch);
    }
    this.setData({ mode, title: modes[mode], total: this.queue.length });
    this.show(0);
  },
  show(index) {
    stopAudio();
    const word = this.queue[index];
    if (!word) { this.setData({ done: true, index }); return; }
    this.word = word;
    const mode = this.data.mode;
    const distractors = mode === "choice"
      ? shuffle([...new Set(this.words.map((w) => w.zh).filter((zh) => zh && zh !== word.zh))]).slice(0, 3)
      : [];
    this.setData({
      index, word, owner: bookOf(word.book).short, value: "", revealed: false, result: null,
      options: mode === "choice" ? shuffle([word.zh, ...distractors]) : [],
      image: mode === "daily" ? wordMedia(word, "img") : "",
      audio: sound(word), newCard: !progress.get().cards[word.id], done: false,
    });
  },
  imageError() { this.setData({ image: "" }); },
  play() { playAudio(this.data.audio); },
  reveal() {
    const card = progress.get().cards[this.word.id];
    const intervals = preview(card, Date.now());
    this.setData({ revealed: true, ratings: ratings.map(([label, id]) => ({ label, id, interval: formatInterval(intervals[id]) })) });
  },
  rate(e) {
    if (!this.data.revealed || this.data.done || this.data.mode !== "daily") return;
    const rating = Number(e.currentTarget.dataset.id);
    if (!ratings.some((row) => row[1] === rating)) return;
    progress.grade(this.word, rating);
    this.show(this.data.index + 1);
  },
  input(e) { this.setData({ value: e.detail.value }); },
  choose(e) { this.grade(this.data.options[Number(e.currentTarget.dataset.index)] === this.word.zh); },
  submit() {
    if (!this.data.value.trim()) return;
    this.grade(gradeDictation(this.data.value, this.word.w, false).correct);
  },
  grade(correct) {
    if (this.data.result !== null || this.data.done) return;
    progress.recordDrill(this.word, correct);
    this.setData({ result: correct ? "correct" : "wrong", correctCount: this.data.correctCount + Number(correct) });
  },
  next() { if (this.data.result !== null && !this.data.done) this.show(this.data.index + 1); },
  leave() { wx.navigateBack(); },
  onHide: stopAudio,
  onUnload: stopAudio,
});
