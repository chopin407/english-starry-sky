import { copyFile, mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BOOKS } from "../src/lib/bookCatalog.ts";
import essays7a from "../src/data/essays/7a.ts";
import essaysFltrp9a from "../src/data/essays/fltrp9a.ts";

const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
const root = fileURLToPath(new URL("../", import.meta.url));
const publicDir = join(root, "public");
const app = join(root, "miniprogram/app");
const { version } = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const buildId = process.env.ENGLISH_GALAXY_BUILD || new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const copied = new Set();
const json = async (path) => JSON.parse(await readFile(join(publicDir, path), "utf8"));
const data = async (path, value) => {
  const dest = join(app, path);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, "module.exports=" + JSON.stringify(value) + ";\n");
};
const copy = async (source, output) => {
  const dest = join(app, output);
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(join(publicDir, source), dest);
  copied.add(dest);
};

const mediaBase = process.env.MINIPROGRAM_MEDIA_BASE?.trim().replace(/\/+$/, "") || "";
if (mediaBase) {
  const url = new URL(mediaBase);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("MINIPROGRAM_MEDIA_BASE 必须是 HTTPS 静态资源地址，不含账号、查询参数或锚点");
  }
}

const books = [];
const library = {};
const textbooks = {};
const bundled = {};
const essays = { "7a": essays7a, fltrp9a: essaysFltrp9a };
for (const book of BOOKS.filter((item) => item.ready)) {
  const id = book.id;
  const atlas = id === "7a" ? "atlas" : `atlas/${id}`;
  const index = await json(`${atlas}/index.json`);
  const chunks = await readdir(join(publicDir, atlas, "entries"));
  const entries = new Map(
    (await Promise.all(chunks.filter((f) => /^\d+\.json$/.test(f)).map((f) => json(`${atlas}/entries/${f}`))))
      .flat().map((entry) => [entry.id, entry]),
  );
  const units = new Map();
  const unit = (key, title) => {
    if (!units.has(key)) units.set(key, { id: key, title: title || key, count: 0 });
    return units.get(key);
  };
  library[id] = index.words.map(([key, word, zh, ipa]) => {
    const entry = entries.get(key);
    if (!entry?.unit) throw new Error(`词条缺少单元: ${id}/${key}`);
    unit(entry.unit, entry.cefr).count++;
    return { id: key, w: word, zh, ipa, u: entry.unit, m: entry.m, p: entry.page, key: entry.key, ex: entry.ex };
  });
  const lessons = (await json(`data/${id}-lessons.json`)).units;
  const points = (await json(`data/${id}-points.json`)).units;
  const chapters = {};
  for (const { unit: key, lessons: rows, title } of lessons) {
    unit(key, title).lessons = rows.length;
    chapters[key] = { lessons: rows, points: [] };
  }
  for (const { unit: key, points: rows, title, label } of points) {
    const summary = unit(key, title || label);
    summary.points = rows.length;
    if (title && title !== summary.title) summary.subtitle = title.startsWith(summary.title + " · ") ? title.slice(summary.title.length + 3) : title;
    chapters[key] = { ...chapters[key], points: rows };
  }
  textbooks[id] = { chapters, essays: essays[id] || [] };
  books.push({ id, name: `${book.edition ?? "人教版"}${book.name}${id === "fltrp9a" ? "上册" : ""}`, short: book.short, units: [...units.values()], essays: essays[id]?.length || 0 });

  if (id === "7a") {
    const sample = library[id].slice(0, 6);
    for (const w of sample) {
      for (const [bit, folder, ext] of [[1, "thumb", "webp"], [2, "audio/uk", "mp3"], [4, "audio/us", "mp3"], [8, "audio/ex", "mp3"], [16, "audio/ex2", "mp3"]]) {
        if (!(w.m & bit)) continue;
        const source = `${atlas}/${folder}/${w.id}.${ext}`;
        const dest = `_generated/media/${folder}/${w.id}.${ext}`;
        await copy(source, dest);
        bundled[source] = "/" + dest;
      }
    }
    const first = lessons[0].lessons[0].audio;
    const dest = "textbook/_generated/sample-lesson.mp3";
    await copy(first, dest);
    bundled[first] = "/" + dest;
  }
}

const { articles } = await json("data/reading.json");
const reading = articles.map(({ id, src, kind, title, words, body, qs }) => ({
  id, src, kind, title, words, body, qs,
  images: [...new Set([...JSON.stringify([body, qs]).matchAll(/\[图:([^\]]+)\]/g)].map((match) => match[1]))],
}));
for (const [i, source] of (reading[0]?.images || []).entries()) {
  const dest = "reading/_generated/sample-" + i + "." + source.split(".").pop();
  await copy(source, dest);
  bundled[source] = "/" + dest;
}
await copy("brand/night.webp", "_generated/night.webp");
async function pruneSample(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) await pruneSample(path);
    else if (item.isFile() && !copied.has(path)) await unlink(path);
  }
}
await pruneSample(join(app, "_generated/media"));
await data("_generated/content.js", { books, library, bundled, mediaBase, version, build: buildId });
await data("textbook/_generated/content.js", textbooks);
await data("reading/_generated/content.js", reading);
await build({
  stdin: {
    contents: `
      export { review, preview, Rating, formatInterval, isMastered } from "./src/store/srs.ts";
      export { dueCardIds } from "./src/store/due.ts";
      export { gradeDictation } from "./src/lib/typing.ts";
      export { essayDraftLimit, essayOpenings, gradeEssay } from "./src/lib/essayPractice.ts";
      export { sameGrammarAnswer, shuffle } from "./src/lib/text.ts";
    `,
    resolveDir: root,
  },
  outfile: join(app, "_generated/learning.js"),
  bundle: true,
  minify: true,
  platform: "neutral",
  mainFields: ["module", "main"],
  format: "cjs",
  target: "es2018",
});

async function size(dir, skip = []) {
  let bytes = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (skip.includes(entry.name)) continue;
    const path = join(dir, entry.name);
    bytes += entry.isDirectory() ? await size(path) : (await stat(path)).size;
  }
  return bytes;
}
const packages = [
  ["主包", await size(app, ["textbook", "reading"])],
  ["课本", await size(join(app, "textbook"))],
  ["阅读", await size(join(app, "reading"))],
];
for (const [name, bytes] of packages) {
  if (bytes >= 2 * 1024 * 1024) throw new Error(`${name}超过 2 MiB 构建预算：${bytes} 字节`);
  console.log(`${name}：${Math.round(bytes / 1024)} KiB`);
}
console.log(`已生成 ${books.length} 册、${Object.values(library).reduce((n, list) => n + list.length, 0)} 条词汇。请导入 miniprogram 目录。`);
