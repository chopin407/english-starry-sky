const { bookOf, wordsOf, open } = require("../lib/library");
const progress = require("../lib/progress");
const PAGE = 40;

Page({
  data: { q: "", unitIndex: 0, limit: PAGE },
  onShow() {
    const { book } = progress.get();
    if (this.book !== book) {
      this.book = book;
      const { name, units } = bookOf(book);
      this.setData({ book, name, units: [{ id: "", title: "全部单元" }, ...units], unitIndex: 0, limit: PAGE });
    }
    this.refresh();
  },
  refresh() {
    const { unitIndex, units, q, limit } = this.data;
    const query = q.trim().toLowerCase();
    const unit = units[unitIndex].id;
    const { cards } = progress.get();
    const matches = wordsOf(this.book).filter((w) => (!unit || w.u === unit) &&
      (!query || w.w.toLowerCase().includes(query) || w.zh.includes(query)));
    this.setData({
      words: matches.slice(0, limit).map(({ id, w, zh, key }) => ({ id, w, zh, key, seen: !!cards[id] })),
      total: matches.length,
    });
  },
  search(e) { this.setData({ q: e.detail.value, limit: PAGE }); this.refresh(); },
  filter(e) { this.setData({ unitIndex: Number(e.detail.value), limit: PAGE }); this.refresh(); },
  onReachBottom() {
    if (this.data.limit >= this.data.total) return;
    this.setData({ limit: this.data.limit + PAGE });
    this.refresh();
  },
  detail(e) { open("pages/word", { book: this.book, id: e.currentTarget.dataset.id }); },
});
