const content = require("./_generated/content");

Page({
  data: { index: 0 },
  onLoad({ book }) { this.setData({ essays: content[book]?.essays || [] }); },
  open(e) {
    const essay = this.data.essays[Number(e.currentTarget.dataset.index)];
    if (essay) this.setData({ essay, index: 0 });
  },
  version(e) { this.setData({ index: Number(e.currentTarget.dataset.index) }); },
  list() { this.setData({ essay: null }); },
});
