const { bookOf, wordsOf, displayWords } = require("./library");
const { review, Rating, isMastered, dueCardIds } = require("../_generated/learning");

const KEY = "english-galaxy-mini:v1";
const today = (t = Date.now()) => {
  const date = new Date(t);
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].join("-");
};
const defaults = () => ({ book: "7a", goal: 10, cards: {}, saved: {}, mistakes: {}, grammar: {}, reading: {}, days: {} });
let state;
function get() {
  if (!state) {
    let cached;
    try { cached = wx.getStorageSync(KEY); } catch (_) { /* storage unavailable */ }
    state = { ...defaults(), ...(cached && typeof cached === "object" ? cached : {}) };
    if (!bookOf(state.book)) state.book = "7a";
  }
  return state;
}
function set(patch) {
  state = { ...get(), ...patch };
  try {
    wx.setStorageSync(KEY, state);
  } catch (_) {
    wx.showToast({ title: "无法保存到本机", icon: "none" });
  }
}
function markDay(now, isNew) {
  const { days } = get();
  const key = today(now);
  const d = days[key] || { reviews: 0, newWords: 0 };
  return { ...days, [key]: { reviews: d.reviews + 1, newWords: d.newWords + Number(isNew) } };
}
function grade(word, rating, now = Date.now()) {
  const { cards } = get();
  const prev = cards[word.id];
  set({ cards: { ...cards, [word.id]: review(prev, rating, now) }, days: markDay(now, !prev) });
}
function plan(now = Date.now()) {
  const { book, cards, goal, days } = get();
  const ids = dueCardIds(cards, now);
  const available = ids.length ? new Map(displayWords(book).map((word) => [word.id, word])) : new Map();
  const due = ids.map((id) => available.get(id)).filter(Boolean);
  const remaining = Math.max(0, goal - (days[today(now)]?.newWords || 0));
  const fresh = wordsOf(book).filter((w) => !cards[w.id]).slice(0, remaining).map((w) => ({ ...w, book }));
  return { due, fresh, studied: days[today(now)]?.reviews || 0 };
}
function toggleSaved(word) {
  const saved = { ...get().saved };
  if (saved[word.id]) delete saved[word.id];
  else saved[word.id] = word.book;
  set({ saved });
  return Boolean(saved[word.id]);
}
function recordDrill(word, correct) {
  const mistakes = { ...get().mistakes };
  if (correct) delete mistakes[word.id];
  else mistakes[word.id] = word.book;
  set({ mistakes });
}
function stats(book) {
  const { cards } = get();
  const words = wordsOf(book);
  const seen = words.filter((w) => cards[w.id]).length;
  const mastered = words.filter((w) => isMastered(cards[w.id])).length;
  return { total: words.length, seen, mastered, percent: words.length ? Math.round(seen / words.length * 100) : 0 };
}

module.exports = { get, set, today, grade, plan, toggleSaved, recordDrill, stats, Rating };
