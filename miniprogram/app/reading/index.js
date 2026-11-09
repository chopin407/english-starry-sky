const articles = require("./_generated/content");
const { open } = require("../lib/library");
const { media } = require("../lib/media");
const progress = require("../lib/progress");
const PAGE = 25;

Page({
  data: { query: "", limit: PAGE },
  onShow() { this.refresh(); },
  refresh() {
    const { query, limit } = this.data;
    const needle = query.trim().toLowerCase();
    const matches = articles.filter((a) => !needle || (a.title + " " + a.src + " " + a.kind).toLowerCase().includes(needle));
    const { reading } = progress.get();
    this.setData({
      total: matches.length,
      articles: matches.slice(0, limit).map(({ id, title, src, kind, words, images }) => ({
        id, title, src, kind, words, result: reading[id] || null, missingImages: images.some((image) => !media(image)),
      })),
    });
  },
  search(e) { this.setData({ query: e.detail.value, limit: PAGE }); this.refresh(); },
  onReachBottom() {
    if (this.data.limit >= this.data.total) return;
    this.setData({ limit: this.data.limit + PAGE });
    this.refresh();
  },
  article(e) { open("reading/article", { id: e.currentTarget.dataset.id }); },
});
