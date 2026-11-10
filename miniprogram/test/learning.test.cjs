const test = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const root = join(__dirname, "../app");
const { books, library, bundled } = require("../app/_generated/content");
const textbooks = require("../app/textbook/_generated/content");
const articles = require("../app/reading/_generated/content");
const config = require("../app/app.json");
const progress = require("../app/lib/progress");
const storage = new Map();

global.wx = {
  getStorageSync: (key) => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, structuredClone(value)),
  setNavigationBarTitle() {},
};
function page(route) {
  let spec;
  global.Page = (definition) => { spec = definition; };
  const file = require.resolve(join(root, route));
  delete require.cache[file];
  require(file);
  return {
    ...spec,
    data: structuredClone(spec.data || {}),
    setData(data) { Object.assign(this.data, structuredClone(data)); },
  };
}
const event = (dataset = {}) => ({ currentTarget: { dataset } });

test("registered pages load and their templates reference existing handlers", () => {
  const routes = [...config.pages, ...config.subPackages.flatMap(({ root, pages }) => pages.map((p) => root + "/" + p))];
  for (const route of routes) {
    const instance = page(route);
    const template = readFileSync(join(root, route + ".wxml"), "utf8");
    for (const [, handler] of template.matchAll(/\b(?:bind|catch)\w+="([\w]+)"/g)) {
      assert.equal(typeof instance[handler], "function", route + ": " + handler);
    }
  }
});

test("all selectable books have working vocabulary and their textbook links resolve", () => {
  for (const book of books) {
    const data = textbooks[book.id];
    assert.ok(data && library[book.id].length);
    assert.equal(book.essays, data.essays.length);
    for (const unit of book.units) {
      assert.equal(unit.count, library[book.id].filter((w) => w.u === unit.id).length);
      assert.equal(unit.lessons || 0, data.chapters[unit.id]?.lessons?.length || 0);
      assert.equal(unit.points || 0, data.chapters[unit.id]?.points?.length || 0);
    }
  }
  for (const file of Object.values(bundled)) assert.ok(existsSync(join(root, file)), file);
  assert.ok(articles[0].images.every((image) => bundled[image]), "first reading can be completed without a CDN");
});

test("new word rating persists its FSRS card, consumes the daily quota and reviews across books", () => {
  const study = page("pages/study");
  study.onLoad({ mode: "daily" });
  const first = study.word;
  const goal = progress.get().goal;
  assert.ok(study.data.audio, "default book has bundled audio");
  study.reveal();
  study.rate(event({ id: progress.Rating.Good }));
  const { cards } = storage.get("english-galaxy-mini:v1");
  assert.ok(cards[first.id].due > cards[first.id].last);
  assert.equal(progress.plan().fresh.length, goal - 1);
  progress.set({ book: "fltrp9a" });
  const due = progress.plan(cards[first.id].due).due.find((word) => word.id === first.id);
  assert.ok(due);
  progress.set({ book: "7a" });
});

test("a misspelled word goes to the wrong-word list and can be cleared by retry", () => {
  const drill = page("pages/study");
  drill.onLoad({ mode: "spell" });
  const word = drill.word;
  drill.input({ detail: { value: "qzxwqz" } });
  drill.submit();
  assert.equal(drill.data.result, "wrong");
  assert.equal(progress.get().mistakes[word.id], word.book);
  const retry = page("pages/study");
  retry.onLoad({ mode: "mistakes" });
  assert.equal(retry.word.id, word.id);
  retry.input({ detail: { value: word.w } });
  retry.submit();
  assert.equal(retry.data.result, "correct");
  assert.equal(progress.get().mistakes[word.id], undefined);
});

test("grammar wrong-answer retry keeps the original question and clears it after correction", () => {
  const point = page("textbook/point");
  point.onLoad({ book: "7a", unit: "starter-unit-1", id: "su1-greet" });
  point.start(event());
  point.choose(event({ index: 1 }));
  assert.equal(point.data.result, "wrong");
  point.intro();
  point.start(event({ mode: "wrong" }));
  assert.equal(point.data.count, 1);
  point.choose(event({ index: 0 }));
  point.next();
  assert.equal(point.data.correctCount, 1);
  assert.equal(point.data.wrong, 0);
});

test("the sample reading can be completed offline and records the score", () => {
  const article = page("reading/article");
  const { id } = articles[0];
  article.onLoad({ id });
  assert.equal(article.data.missingImages, false);
  for (const q of article.questions) {
    article.pick(event({ id: q.ans }));
    article.next();
  }
  assert.equal(article.data.done, true);
  assert.deepEqual(progress.get().reading[id], { correct: article.questions.length, total: article.questions.length });
});

test("essay practice grades the selected version and keeps the draft for correction", () => {
  const essay = page("textbook/essay");
  essay.onLoad({ book: "7a" });
  essay.open(event({ index: 0 }));
  essay.version(event({ index: 1 }));
  essay.startPractice();
  assert.equal(essay.data.practicing, true);
  assert.equal(essay.data.canSubmit, false);
  assert.equal(essay.data.openings.length, essay.data.essay.versions[1].paragraphs.length);
  essay.toggleOpenings();
  assert.equal(essay.data.openingHint, true);
  const [basic, selected] = essay.data.essay.versions;
  const wrongVersion = basic.paragraphs.join("\n\n");
  essay.inputDraft({ detail: { value: wrongVersion } });
  essay.submitPractice();
  assert.equal(essay.data.result.correct, false);
  essay.editPractice();
  assert.equal(essay.data.draft, wrongVersion);
  essay.inputDraft({ detail: { value: selected.paragraphs.join("\n\n").toLowerCase() } });
  essay.submitPractice();
  assert.equal(essay.data.result.correct, true);
  assert.match(essay.data.result.formatText, /大小写/);
  essay.startPractice();
  assert.equal(essay.data.draft, "");
  assert.equal(essay.data.index, 1);
});
