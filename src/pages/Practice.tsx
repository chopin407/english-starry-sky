import { ArrowRight, Check, Clock, Headphones, Languages, RotateCcw, Snail, Type, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { prefetch, useAtlas } from "../atlas/context";
import { MEDIA, type Entry } from "../atlas/types";
import { play, stopAudio } from "../lib/audio";
import { cue } from "../lib/sound";
import { hashSeed, shuffle } from "../lib/text";
import { dictationWordForms, gradeDictation, type DictationGrade } from "../lib/typing";
import { practiceKey, updatePracticeReview, type PracticeMode, type PracticePrompt } from "../store/practiceReview";
import { formatInterval } from "../store/srs";
import { store, useStore } from "../store/store";
import { AmbiencePicker } from "../ui/Ambience";
import { Illustration } from "../ui/Illustration";
import { SpellInput } from "../ui/SpellInput";
import { Quiz, WrongPanel, type Item } from "./Points";
import { ChallengeSwitch } from "./Challenge";

type Source = "recent" | "mistakes" | "saved" | "path";
type Question = { prompt: PracticePrompt; entry: Entry; atlas: ReturnType<typeof useAtlas> };

const MODES: [PracticeMode, string, string, typeof Type][] = [
  ["word", "单词听写", "听发音、看图，写出单词", Type],
  ["dictation", "短句听写", "听英文短句，写下整句", Headphones],
  ["sentence", "中文听写", "看中文意思，写出英文句子", Languages],
];
const SOURCES: [Source, string][] = [
  ["recent", "最近学过"],
  ["mistakes", "错词本"],
  ["saved", "收藏"],
  ["path", "学习路线"],
];

const RANGE_KEY = "word-atlas:practice-range:";
const unitShort = (u: string) => u.replace(/^Starter Unit /, "预备").replace(/^Unit /, "");
const sorted = (a: number, b: number): [number, number] => (a <= b ? [a, b] : [b, a]);
const modeName = (mode: PracticeMode) => MODES.find(([id]) => id === mode)?.[1];
const answer = ({ prompt, entry }: Question) => (prompt.mode === "word" ? entry.w : entry.ex[0].en);

function loadRange(book: string, n: number, start: number): [number, number] {
  try {
    const r = JSON.parse(localStorage.getItem(RANGE_KEY + book) || "null");
    if (Array.isArray(r) && r[0] >= 0 && r[1] < n && r[0] <= r[1]) return [r[0], r[1]];
  } catch {
    /* optional */
  }
  return [Math.min(start, n - 1), n - 1];
}

/** 单元范围：点一个只练这一单元，再点一个就选中两者之间的全部；也可以按住拖过去 */
function UnitRange({ units, value, onChange }: { units: string[]; value: [number, number]; onChange: (r: [number, number]) => void }) {
  const [anchor, setAnchor] = useState<number | null>(null);
  const drag = useRef<{ from: number; moved: boolean; second: boolean } | null>(null);
  const at = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-u]");
    return el ? Number(el.dataset.u) : null;
  };
  const [lo, hi] = value;
  return (
    <div className="unit-range">
      <div
        className="unit-range-track"
        onPointerDown={(e) => {
          const u = at(e.clientX, e.clientY);
          if (u === null) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          const second = anchor !== null && anchor !== u;
          const from = second ? anchor : u;
          drag.current = { from, moved: false, second };
          onChange(sorted(from, u));
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          const u = d && at(e.clientX, e.clientY);
          if (!d || u === null) return;
          if (u !== d.from) d.moved = true;
          onChange(sorted(d.from, u));
        }}
        onPointerUp={() => {
          const d = drag.current;
          drag.current = null;
          if (!d) return;
          setAnchor(d.moved || d.second ? null : d.from);
        }}
        onPointerCancel={() => (drag.current = null)}
      >
        {units.map((u, i) => (
          <button
            key={u}
            type="button"
            data-u={i}
            className={`${i >= lo && i <= hi ? "is-in" : ""} ${i === lo ? "is-lo" : ""} ${i === hi ? "is-hi" : ""} ${i === anchor ? "is-anchor" : ""}`}
            aria-pressed={i >= lo && i <= hi}
            aria-label={u}
          >
            {unitShort(u)}
          </button>
        ))}
      </div>
      <div className="unit-range-foot">
        <small>{anchor !== null ? "再点一个单元，就选到那里为止" : "点一个单元只练它；再点另一个，中间的都选上；也可以按住拖动"}</small>
        {(lo !== 0 || hi !== units.length - 1) && (
          <button
            type="button"
            className="unit-range-all"
            onClick={() => {
              setAnchor(null);
              onChange([0, units.length - 1]);
            }}
          >
            全部单元
          </button>
        )}
      </div>
    </div>
  );
}

export function Practice() {
  const atlas = useAtlas();
  const progress = useStore((s) => s.progress);
  const startLevel = useStore((s) => s.settings.startLevel);
  const [mode, setMode] = useState<PracticeMode>("word");
  const [source, setSource] = useState<Source>(() => (Object.keys(progress.cards).length ? "recent" : "path"));
  const [ranges, setRanges] = useState<Record<string, [number, number]>>({});
  const book = atlas.book ?? "7a";
  const range = ranges[book] ?? loadRange(book, atlas.cefr.length, startLevel);
  const setRange = (r: [number, number]) => {
    setRanges((m) => ({ ...m, [book]: r }));
    try {
      localStorage.setItem(RANGE_KEY + book, JSON.stringify(r));
    } catch {
      /* optional */
    }
  };
  const [round, setRound] = useState<{ questions: Question[]; review: boolean; key: number } | null>(null);
  const [quiz, setQuiz] = useState<{ items: Item[]; title: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [now, setNow] = useState(Date.now);
  const atlasForBook = (id: string) => (id === (atlas.book ?? "") ? atlas : atlas.shelf?.find((a) => a.book === id));
  const reviews = Object.values(progress.practiceReviews)
    .filter((item) => atlasForBook(item.book)?.byId.has(item.id))
    .sort((a, b) => a.due - b.due);
  const due = reviews.filter((item) => item.due <= now);
  const nextDue = reviews[due.length]?.due;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [quiz, round]);

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = nextDue === undefined ? undefined : window.setTimeout(refresh, Math.min(60_000, Math.max(0, nextDue - Date.now())));
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [nextDue, now]);

  const pool = useMemo(() => {
    const learned = Object.entries(progress.cards)
      .sort((a, b) => (b[1].last ?? 0) - (a[1].last ?? 0))
      .map(([id]) => id);
    const ids =
      // 学习路线：本册选中单元范围里的全部单词，学生自己挑练哪几个单元
      source === "recent"
        ? learned
        : source === "mistakes"
          ? progress.mistakes
          : source === "saved"
            ? progress.bookmarks
            : atlas.words.filter((w) => w.cefr >= range[0] && w.cefr <= range[1]).map((w) => w.id);
    // 短句、中文听写只算有例句的词：显示的就是实际能出的句子数，抽题也不会抽到空的
    return ids.filter((id) => {
      const w = atlas.byId.get(id);
      return !!w && (mode === "word" || (w.media & MEDIA.ex) > 0 || !!atlas.peek(id)?.ex.length);
    });
  }, [atlas, progress.cards, progress.mistakes, progress.bookmarks, source, range[0], range[1], mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async (prompts: PracticePrompt[], review: boolean) => {
    if (loading || !prompts.length) return;
    setLoading(true);
    setLoadError(false);
    const questions = await Promise.all(prompts.map(async (prompt) => {
      const owner = atlasForBook(prompt.book);
      if (!owner) return null;
      const [entry] = await prefetch(owner, [prompt.id]);
      if (!entry || (prompt.mode !== "word" && !entry.ex[0]?.en)) return null;
      return { prompt, entry, atlas: owner };
    }));
    const ready = questions.filter((question): question is Question => question !== null);
    setLoading(false);
    if (ready.length) setRound({ questions: ready, review, key: Date.now() });
    else setLoadError(true);
  };

  const startRegular = () => {
    // 最近学过：从最近的 60 个里抽，练的是刚学的；其他来源：整个来源里随机抽（原来只从前 60 个抽，学习路线总是抽到第一单元）
    const ids = shuffle(source === "recent" ? pool.slice(0, 60) : pool, hashSeed(String(Date.now()))).slice(0, 10);
    const prompts = ids.map((id) => {
      const owner = atlas.words.some((w) => w.id === id) ? atlas : atlas.shelf?.find((a) => a.byId.has(id)) ?? atlas;
      return { id, mode, book: owner.book ?? "" };
    });
    void start(prompts, false);
  };
  const startReview = () => void start(due.slice(0, 10), true);

  if (quiz) return <Quiz items={quiz.items} title={quiz.title} onExit={() => setQuiz(null)} />;
  if (round) return (
    <DictationRound
      key={round.key}
      questions={round.questions}
      review={round.review}
      onExit={() => { setNow(Date.now()); setLoadError(false); setRound(null); }}
      onAgain={round.review ? (due.length ? startReview : undefined) : startRegular}
      loading={loading}
      loadError={loadError}
    />
  );

  const rounds = progress.typing.filter((t) => t.mode === mode);
  const noun = mode === "word" ? "词" : mode === "dictation" ? "短句" : "句子";
  const best = rounds.reduce((m, t) => Math.max(m, t.accuracy), 0);
  return (
    <div className="page practice">
      <header className="page-head">
        <div className="challenge-head">
          <p className="eyebrow">练习</p>
          <ChallengeSwitch />
        </div>
        <h1 className="display">听一听，写一写。</h1>
        <p className="lede">直接输入英文答案，提交后立即判分。错题会加入错词本，并安排间隔复习。</p>
      </header>
      <section className="panel practice-review" aria-labelledby="practice-review-title">
        <div className="practice-review-icon"><Clock size={22} aria-hidden="true" /></div>
        <div className="practice-review-copy">
          <p className="eyebrow">艾宾浩斯间隔复习</p>
          <h2 id="practice-review-title">听写错题复习</h2>
          <p className="muted" aria-live="polite">
            {due.length ? `${due.length} 题已到期，按原题型复习。` : nextDue === undefined ? "答错 20 分钟后开启第一次复习。" : "当前没有到期错题。"}
            {nextDue !== undefined && ` 下次复习 ${new Date(nextDue).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}。`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={startReview} disabled={loading || !due.length}>复习到期错题</button>
      </section>
      {loadError && <p role="alert" className="muted">题目暂时加载失败，请重试。</p>}
      <div className="practice-grid">
        <section className="panel">
          <h3 className="eyebrow">模式</h3>
          <div className="mode-cards">
            {MODES.map(([k, name, desc, Icon]) => (
              <button key={k} className={`mode-card ${mode === k ? "is-on" : ""}`} onClick={() => setMode(k)} aria-pressed={mode === k}>
                <Icon size={22} strokeWidth={1.7} />
                <b>{name}</b>
                <small>{desc}</small>
              </button>
            ))}
          </div>
          {/* 短句、中文听写写的是这些词的例句，标题和说明跟着改，免得学生以为还是写单词 */}
          <h3 className="eyebrow">{mode === "word" ? "词来自" : "句子来自（用这些词的例句出题）"}</h3>
          <div className="segmented segmented-wide segmented-wrap">
            {SOURCES.map(([k, label]) => (
              <button key={k} className={source === k ? "is-on" : ""} onClick={() => setSource(k)} aria-pressed={source === k}>
                {label}
              </button>
            ))}
          </div>
          {source === "path" && <UnitRange units={atlas.cefr} value={range} onChange={setRange} />}
          <p className="muted">
            {pool.length
              ? source === "path"
                ? `${atlas.cefr[range[0]]}${range[1] !== range[0] ? ` – ${atlas.cefr[range[1]]}` : ""}，共 ${pool.length} 个${noun}，每轮随机抽 ${Math.min(10, pool.length)} 个。${mode === "sentence" ? "" : "每题都会自动朗读。"}`
                : source === "recent"
                  ? pool.length <= 10
                    ? `最近学过 ${pool.length} 个${noun}，每轮全部练一遍。`
                    : `从最近学过的 ${Math.min(pool.length, 60)} 个${noun}里，每轮随机抽 10 个。`
                  : pool.length <= 10
                    ? `共 ${pool.length} 个${noun}，每轮全部练一遍。`
                    : `共 ${pool.length} 个${noun}，每轮随机抽 10 个。`
              : `这里还没有${noun}。先去学几个${noun}，或者换成「学习路线」。`}
          </p>
          <button className="btn btn-primary btn-xl" onClick={startRegular} disabled={loading || !pool.length}>
            开始一轮
          </button>
        </section>
        <WrongPanel onPractice={(items, title) => setQuiz({ items, title })} />
        <section className="panel practice-side">
          <img src={`${import.meta.env.BASE_URL}brand/listen.webp`} alt="" />
          <dl className="mini-stats">
            <div>
              <dt>最好成绩</dt>
              <dd>
                {best}
                <small>% 全对</small>
              </dd>
            </div>
            <div>
              <dt>完成轮次</dt>
              <dd>{rounds.length}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}

/* ---------- 在线听写 ---------- */

/** 把答案里容易写错的地方标出来：本词、大写字母、标点 */
function markTricky(sentence: string, word: string) {
  const out: { text: string; kind: "word" | "cap" | "punct" | "" }[] = [];
  const head = word.toLowerCase().split(/\s+/)[0];
  for (const tok of sentence.match(/[A-Za-z]+(?:['’][A-Za-z]+)*|[^A-Za-z\s]+|\s+/g) ?? []) {
    if (/^[A-Za-z]/.test(tok)) {
      const low = tok.toLowerCase();
      if (head && (low === head || (low.startsWith(head) && low.length - head.length <= 3))) out.push({ text: tok, kind: "word" });
      else if (/[A-Z]/.test(tok)) out.push({ text: tok, kind: "cap" });
      else out.push({ text: tok, kind: "" });
    } else if (/\S/.test(tok)) out.push({ text: tok, kind: "punct" });
    else out.push({ text: tok, kind: "" });
  }
  return out;
}

function DictationRound({ questions, review, onExit, onAgain, loading, loadError }: {
  questions: Question[];
  review: boolean;
  onExit: () => void;
  onAgain?: () => void;
  loading: boolean;
  loadError: boolean;
}) {
  const settings = useStore((s) => s.settings);
  const [i, setI] = useState(0);
  const [value, setValue] = useState("");
  const [nextInterval, setNextInterval] = useState("");
  const [results, setResults] = useState<DictationGrade[]>([]);
  const question = questions[i];
  const grade = results[i];
  const mode = question?.prompt.mode ?? questions[0].prompt.mode;
  const say = (rate = 1) => {
    if (!question) return;
    const { atlas, entry } = question;
    void play(atlas.audio(entry, mode === "word" ? settings.accent : "ex"), answer(question), settings.accent, rate);
  };

  useEffect(() => {
    // 中文听写不自动读，读了就成了短句听写
    if (question && mode !== "sentence") say();
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopAudio(), []);

  const judge = (submitted: string) => {
    if (!question || grade) return;
    const { prompt } = question;
    const result = gradeDictation(submitted, answer(question), mode !== "word");
    const ok = result.correct;
    if (settings.sfx) void cue(ok ? "correct" : "wrong");
    const next = [...results, result];
    setValue(submitted);
    setResults(next);
    const now = Date.now();
    const practiceReviews = store.get().progress.practiceReviews;
    const updated = updatePracticeReview(practiceReviews, prompt, ok, now);
    const roundFinished = !review && next.length === questions.length;
    if (updated !== practiceReviews || roundFinished) store.progress((p) => ({
      ...p,
      practiceReviews: updated,
      mistakes: ok ? p.mistakes : [prompt.id, ...p.mistakes.filter((id) => id !== prompt.id)].slice(0, 300),
      typing: roundFinished
        ? [...p.typing, { at: now, mode, items: questions.length, wpm: 0, accuracy: Math.round(next.filter((r) => r.correct).length / questions.length * 100) }].slice(-500)
        : p.typing,
    }));
    const due = updated[practiceKey(prompt)]?.due;
    setNextInterval(due === undefined ? "" : formatInterval(due - now));
  };

  const advance = () => {
    stopAudio();
    if (i + 1 === questions.length && settings.sfx) void cue("complete");
    setValue("");
    setI(i + 1);
  };

  if (!question) {
    const right = results.filter((r) => r.correct).length;
    const wrong = questions.filter((_, k) => !results[k].correct);
    return (
      <div className="page practice">
        <section className="panel typing-done">
          <p className="eyebrow">{review ? "错题复习" : modeName(mode)}完成</p>
          <h1 className="display">
            {right}
            <small>
              /{questions.length} 题答对
            </small>
          </h1>
          {wrong.length > 0 && (
            <div className="paper-wrong">
              <p className="lede">以下错题已加入错词本，20 分钟后可以复习。</p>
              <ul>
                {wrong.map((w) => (
                  <li key={practiceKey(w.prompt)} lang="en">
                    {answer(w)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="summary-actions">
            <button className="btn btn-ghost" onClick={onExit}>
              返回
            </button>
            {onAgain && (
              <button className="btn btn-primary btn-xl" onClick={onAgain} disabled={loading}>
                <RotateCcw size={18} /> {review ? "继续复习" : "再来一轮"}
              </button>
            )}
          </div>
          {loadError && <p role="alert" className="muted">题目暂时加载失败，请重试。</p>}
        </section>
      </div>
    );
  }

  const { atlas, entry: e } = question;
  const expected = answer(question);
  const format = grade?.format;
  const parts = format?.reference ?? (grade ? markTricky(expected, e.w) : []);
  const tip =
    mode === "word" ? "听发音，根据提示输入英文单词。" : mode === "dictation" ? "听录音，输入完整的英文句子。注意大小写和标点。" : "根据中文提示输入英文例句。按词库例句判分，注意大小写和标点。";
  return (
    <div className="page practice typing paper">
      <header className="typing-top">
        <button className="btn btn-ghost" onClick={onExit}>
          结束
        </button>
        <AmbiencePicker />
        <div className="learn-progress">
          <span style={{ width: `${(results.length / questions.length) * 100}%` }} />
        </div>
        <span className="typing-meter">
          {review && `${modeName(mode)} · `}第 <b>{i + 1}</b>/{questions.length} 题
        </span>
      </header>
      <section className="paper-stage">
        <p className="paper-tip">{tip}</p>
        {mode === "word" && (
          <div className="paper-cue">
            <Illustration key={i} src={atlas.img(e)} word={e.w} topic={0} eager hideWord />
            <p>
              <span className="pos">{e.senses[0]?.pos}</span> {e.senses[0]?.zh}
            </p>
          </div>
        )}
        {mode === "sentence" && <p className="paper-zh">{e.ex[0].zh}</p>}
        <div className="paper-listen">
          <button className={`btn ${mode === "sentence" ? "btn-ghost" : "btn-primary btn-xl"}`} onClick={() => say()}>
            <Headphones size={20} /> {mode === "sentence" ? "想不起来？听一遍" : "再听一遍"}
          </button>
          {mode !== "sentence" && (
            <button className="btn btn-ghost" onClick={() => say(0.7)}>
              <Snail size={18} /> 慢速
            </button>
          )}
        </div>

        {!grade ? (
          <SpellInput key={i} target={mode === "word" ? dictationWordForms(expected)[0] : expected.trim()} onSubmit={judge} />
        ) : (
          <div className="paper-answer">
            <div role="status" className={`paper-verdict ${grade.correct ? "is-correct" : "is-wrong"}`}>
              {grade.correct ? <Check size={20} aria-hidden="true" /> : <X size={20} aria-hidden="true" />}
              <b>{grade.correct ? "回答正确" : "答错了 · 已加入错词本"}</b>
              {format && <span className="paper-format-note">注意{format.kinds.map((kind) => kind === "cap" ? "大小写" : "标点").join("和")}</span>}
            </div>
            {(!grade.correct || format) && (
              <p className="paper-submitted">
                你的答案 <span lang="en">{format ? format.submitted.map((p, k) => p.kind ? <mark key={k} className={`pm-${p.kind}`}>{p.text}</mark> : p.text) : value}</span>
              </p>
            )}
            {(!grade.correct || format) && <p className="eyebrow">参考答案</p>}
            <p className={`paper-sentence ${mode === "word" ? "is-word" : ""}`} lang="en">
              {parts.map((p, k) => (p.kind ? <mark key={k} className={`pm-${p.kind}`}>{p.text}</mark> : <span key={k}>{p.text}</span>))}
            </p>
            {mode === "word" && <p className="muted">{e.uk}</p>}
            {mode === "dictation" && <p className="paper-zh-small">{e.ex[0].zh}</p>}
            {(mode !== "word" || format) && (
              <p className="paper-legend">
                {!format && <mark className="pm-word">本课单词 {e.w}</mark>}
                {(!format || format.kinds.includes("cap")) && <mark className="pm-cap">大小写</mark>}
                {(!format || format.kinds.includes("punct")) && <mark className="pm-punct">标点</mark>}
              </p>
            )}
            {nextInterval && <p className="muted">{nextInterval}后可以复习这道题。</p>}
            {review && grade.correct && !nextInterval && <p className="muted">这道题已完成全部间隔复习。</p>}
            <button className="btn btn-primary paper-next" onClick={advance} autoFocus>
              {i + 1 === questions.length ? "查看结果" : "下一题"} <ArrowRight size={18} />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
