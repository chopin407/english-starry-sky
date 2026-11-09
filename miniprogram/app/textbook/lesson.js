const content = require("./_generated/content");
const { media, playAudio, stopAudio } = require("../lib/media");

Page({
  data: { showZh: false, playing: -2 },
  onLoad({ book, unit, id }) {
    const lesson = content[book]?.chapters[unit]?.lessons?.find((l) => l.id === id);
    if (!lesson) return;
    this.setData({ lesson, src: media(lesson.audio) });
  },
  toggleZh() { this.setData({ showZh: !this.data.showZh }); },
  play(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (index === this.data.playing) { this.stop(); return; }
    const line = this.data.lesson.lines[index];
    this.setData({ playing: index });
    if (!playAudio(this.data.src, line?.s, line?.e, () => this.setData({ playing: -2 }))) this.stop();
  },
  stop() { stopAudio(); this.setData({ playing: -2 }); },
  onHide() { this.stop(); },
  onUnload: stopAudio,
});
