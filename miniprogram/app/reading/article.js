const articles = require("./_generated/content");
const { media } = require("../lib/media");
const progress = require("../lib/progress");

function parts(text) {
  return text.split(/(\[图:[^\]]+\])/g).filter(Boolean).map((value, i) => {
    const path = /^\[图:([^\]]+)\]$/.exec(value)?.[1];
    return path ? { i, image: media(path), text: "［试题配图］" } : { i, text: value };
  });
}

Page({
  data: { step: 0, correct: 0, done: false, picked: "", showBody: true },
  onLoad({ id }) {
    const article = articles.find((a) => a.id === id);
    if (!article) return;
    this.id = id;
    this.questions = article.qs.flatMap((q) => q.six
      ? q.blanks.map((n) => ({ label: n, stem: "选择能填入原文第 " + n + " 空的句子", opts: q.opts, ans: q.ans[n], ex: q.ex?.[n] }))
      : [{ ...q, label: q.n }]);
    const missingImages = article.images.some((image) => !media(image));
    this.setData({
      title: article.title, source: article.src, total: this.questions.length, missingImages,
      paragraphs: article.body.map((text, id) => ({ id, pieces: parts(text) })),
    });
    if (!missingImages) this.show(0);
  },
  show(step) {
    const q = this.questions[step];
    if (!q) {
      if (this.questions.length) {
        const reading = { ...progress.get().reading, [this.id]: { correct: this.data.correct, total: this.questions.length } };
        progress.set({ reading });
      }
      this.setData({ done: true });
      return;
    }
    this.question = q;
    this.setData({
      step, stem: parts(q.stem || ""), label: q.label,
      options: q.opts.map(([id, value]) => ({ id, parts: parts(value) })),
      picked: "", answer: "", why: "", evidence: "",
    });
  },
  toggleBody() { this.setData({ showBody: !this.data.showBody }); },
  pick(e) {
    if (this.data.picked || this.data.done) return;
    const picked = e.currentTarget.dataset.id;
    const { ans, ex } = this.question;
    const correct = picked === ans;
    this.setData({
      picked, answer: ans, correct: this.data.correct + Number(correct),
      why: correct ? "" : ex?.why || "", evidence: correct ? "" : ex?.ev || "",
    });
  },
  next() { if (this.data.picked && !this.data.done) this.show(this.data.step + 1); },
  restart() { this.setData({ correct: 0, done: false }); this.show(0); },
});
