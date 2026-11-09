const { bundled, mediaBase } = require("../_generated/content");
let player;

function media(path) {
  if (!path) return "";
  return bundled[path] || (mediaBase ? mediaBase + "/" + path.split("/").map(encodeURIComponent).join("/") : "");
}
function wordMedia(word, kind) {
  const root = word.book === "7a" ? "atlas" : "atlas/" + word.book;
  const bit = { img: 1, uk: 2, us: 4, ex: 8, ex2: 16 }[kind];
  if (!(word.m & bit)) return "";
  return media(root + (kind === "img" ? "/thumb/" + word.id + ".webp" : "/audio/" + kind + "/" + word.id + ".mp3"));
}
function stopAudio() {
  const audio = player;
  player = undefined;
  if (audio) audio.destroy();
}
function playAudio(src, start, end, onStop) {
  stopAudio();
  if (!src) {
    wx.showToast({ title: "暂无可用录音", icon: "none" });
    return false;
  }
  const audio = wx.createInnerAudioContext();
  player = audio;
  const finish = () => {
    if (player !== audio) return;
    stopAudio();
    if (onStop) onStop();
  };
  audio.onEnded(finish);
  audio.onError(() => {
    if (player !== audio) return;
    finish();
    wx.showToast({ title: "录音加载失败，请重试", icon: "none" });
  });
  if (Number.isFinite(end)) audio.onTimeUpdate(() => {
    if (audio.currentTime >= end) finish();
  });
  audio.startTime = Number.isFinite(start) ? start : 0;
  audio.src = src;
  audio.play();
  return true;
}

module.exports = { media, wordMedia, playAudio, stopAudio };
