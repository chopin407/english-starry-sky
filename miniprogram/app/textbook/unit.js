const { bookOf, open } = require("../lib/library");
const content = require("./_generated/content");

Page({
  onLoad({ book, unit }) {
    this.params = { book, unit };
    const info = bookOf(book)?.units.find((u) => u.id === unit);
    const chapter = content[book]?.chapters[unit];
    this.setData({
      title: info?.title || "教材单元",
      subtitle: info?.subtitle || bookOf(book)?.name || "",
      lessons: (chapter?.lessons || []).map(({ id, title, lines }) => ({ id, title, count: lines.length })),
      points: (chapter?.points || []).map(({ id, title, kp, questions }) => ({ id, title, kp, count: questions.length })),
    });
  },
  detail(e) {
    const { type, id } = e.currentTarget.dataset;
    open("textbook/" + type, { ...this.params, id });
  },
});
