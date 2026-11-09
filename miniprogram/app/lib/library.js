const { books, library } = require("../_generated/content");
const { shuffle } = require("../_generated/learning");

const bookOf = (id) => books.find((b) => b.id === id);
const wordsOf = (id) => library[id] || [];
const wordOf = (book, id) => wordsOf(book).find((w) => w.id === id);
const displayWords = (book, id) => {
  const out = [];
  const seen = new Set();
  for (const owner of [book, ...books.map((b) => b.id).filter((key) => key !== book)]) {
    for (const word of wordsOf(owner)) {
      if (id && word.id !== id || seen.has(word.id)) continue;
      out.push({ book: owner, ...word });
      seen.add(word.id);
    }
  }
  return out;
};

function open(path, params = {}) {
  const query = Object.keys(params).map((k) => k + "=" + encodeURIComponent(params[k])).join("&");
  wx.navigateTo({ url: "/" + path + (query ? "?" + query : "") });
}

module.exports = { books, bookOf, wordsOf, wordOf, displayWords, open, shuffle };
