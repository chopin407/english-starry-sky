const content = require("./_generated/content");
const { shuffle } = require("../lib/library");
const progress = require("../lib/progress");
const { sameGrammarAnswer: same } = require("../_generated/learning");

Page({
  data: { started: false, correctCount: 0 },
  onLoad({ book, unit, id }) {
    this.point = content[book]?.chapters[unit]?.points?.find((p) => p.id === id);
    if (!this.point) return;
    this.key = book + ":" + unit + ":" + id;
    this.setData({ point: this.point, total: this.point.questions.length });
    this.countWrong();
  },
  countWrong() {
    const records = progress.get().grammar;
    const wrong = this.point.questions.filter((_, i) => records[this.key + ":" + i] === false).length;
    this.setData({ wrong });
  },
  start(e) {
    const onlyWrong = e.currentTarget.dataset.mode === "wrong";
    const records = progress.get().grammar;
    this.queue = this.point.questions.map((_, i) => i).filter((i) => !onlyWrong || records[this.key + ":" + i] === false);
    if (!this.queue.length) return;
    this.setData({ started: true, done: false, correctCount: 0, count: this.queue.length });
    this.show(0);
  },
  show(step) {
    this.q = this.point.questions[this.queue[step]];
    if (!this.q) { this.setData({ done: true }); this.countWrong(); return; }
    const tokens = this.q.t === "order" ? shuffle(this.q.w.map((word, id) => ({ word, id }))) : [];
    this.setData({ step, q: this.q, tokens, chosen: [], typed: "", result: "", selected: -1, answer: "" });
  },
  input(e) { this.setData({ typed: e.detail.value }); },
  pick(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (this.data.result || this.data.chosen.some((t) => t.id === id)) return;
    this.setData({
      chosen: [...this.data.chosen, this.data.tokens.find((t) => t.id === id)],
      tokens: this.data.tokens.map((t) => t.id === id ? { ...t, used: true } : t),
    });
  },
  undo() {
    if (this.data.result || !this.data.chosen.length) return;
    const chosen = this.data.chosen.slice();
    const { id } = chosen.pop();
    this.setData({ chosen, tokens: this.data.tokens.map((t) => t.id === id ? { ...t, used: false } : t) });
  },
  choose(e) {
    if (this.data.result) return;
    const selected = Number(e.currentTarget.dataset.index);
    this.setData({ selected });
    this.grade(selected === this.q.a, this.q.o[this.q.a]);
  },
  submit() {
    if (this.data.result) return;
    if (this.q.t === "fill" && this.data.typed.trim()) {
      this.grade(this.q.a.some((answer) => same(this.data.typed, answer)), this.q.a.join(" / "));
    } else if (this.q.t === "order" && this.data.chosen.length === this.q.w.length) {
      this.grade(same(this.data.chosen.map((t) => t.word).join(" "), this.q.a), this.q.a);
    }
  },
  grade(correct, answer) {
    progress.set({ grammar: { ...progress.get().grammar, [this.key + ":" + this.queue[this.data.step]]: correct } });
    this.setData({ result: correct ? "correct" : "wrong", answer, correctCount: this.data.correctCount + Number(correct) });
  },
  next() { if (this.data.result && !this.data.done) this.show(this.data.step + 1); },
  intro() { this.countWrong(); this.setData({ started: false }); },
});
