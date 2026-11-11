import { ArrowRight, Check, RotateCcw, Share2, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { prefetch, useAtlas, useEntry } from "../atlas/context";
import type { Entry, WordRef } from "../atlas/types";
import { play, preloadAudio, stopAudio } from "../lib/audio";
import { burst } from "../lib/burst";
import { cue } from "../lib/sound";
import { go, type Route } from "../lib/router";
import { gap, normalize } from "../lib/text";
import { EXTENSION_UNIT } from "../lib/unit";
import { answer, advance, buildSession, gradeFor, journeyProgress, sessionFor, sessionStats, shortFollowUp, withSession } from "../store/session";
import { formatInterval, Rating } from "../store/srs";
import { store, useStore, type ActiveSession, type QuizKind, type Step } from "../store/store";
import { EntryView, Highlight } from "../ui/EntryView";
import { Illustration } from "../ui/Illustration";
import { Galaxy } from "../galaxy/Galaxy";
import { AmbiencePicker } from "../ui/Ambience";
import { Ring } from "../ui/Ring";
import { Speak } from "../ui/Speak";
import { SpellInput } from "../ui/SpellInput";
import { SpellingEncouragement } from "../ui/SpellingEncouragement";
import { shareSession } from "../ui/shareSession";

export function Learn() {
  const atlas = useAtlas();
  const session = useStore((s) => sessionFor(atlas, s.progress));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { progress, settings } = store.get();
    if (!sessionFor(atlas, progress)) {
      const s = buildSession(atlas, progress, settings);
      if (!s.steps.length) {
        go({ page: "today" }, null, true);
        return;
      }
      store.progress((p) => withSession(atlas, p, s));
    }
  }, [atlas]);

  const ids = useMemo(() => [...new Set(session?.steps.map((s) => s.id) ?? [])], [session?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ids.length) return;
    let live = true;
    // Load the first chunk before rendering, the rest in the background.
    prefetch(atlas, ids.slice(0, 6)).then(() => live && setReady(true));
    void prefetch(atlas, ids);
    return () => {
      live = false;
    };
  }, [atlas, ids]);

  useEffect(() => {
    const stopWhenHidden = () => {
      if (document.visibilityState === "hidden") stopAudio();
    };
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => {
      document.removeEventListener("visibilitychange", stopWhenHidden);
      stopAudio();
    };
  }, []);

  if (!session || !ready) return <div className="learn learn-loading"><span className="spinner" /></div>;
  if (session.finished || session.index >= session.steps.length) return <Summary session={session} />;
  return <Runner session={session} />;
}

function Runner({ session }: { session: ActiveSession }) {
  const atlas = useAtlas();
  const accent = useStore((s) => s.settings.accent);
  const step = session.steps[session.index];
  const total = session.steps.length;
  // 当前这题和后面几题的单词录音先下载好，出题、答对时立刻能读出来
  useEffect(() => {
    for (const s of session.steps.slice(session.index, session.index + 5)) {
      const ref = atlas.byId.get(s.id);
      if (ref) void preloadAudio(atlas.audio(ref, accent));
    }
  }, [atlas, accent, session.steps, session.index]);
  const exit = () => {
    stopAudio();
    go({ page: "today" });
  };
  return (
    <div className="learn">
      <header className="learn-top">
        <button className="icon-btn" onClick={exit} aria-label="暂停并返回">
          <X size={22} />
        </button>
        <div className="learn-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={session.index}>
          <span style={{ width: `${(session.index / total) * 100}%` }} />
        </div>
        <span className="learn-count">
          {session.index + 1}
          <small>/{total}</small>
        </span>
        <AmbiencePicker />
      </header>
      <main className="learn-stage" key={`${session.id}-${session.index}`}>
        {step.kind === "intro" ? <Intro step={step} /> : <Quiz step={step as Step & { kind: QuizKind }} session={session} />}
      </main>
    </div>
  );
}

function useStepTimer() {
  const t = useRef(performance.now());
  return () => (performance.now() - t.current) / 1000;
}

function Intro({ step }: { step: Step }) {
  const atlas = useAtlas();
  const { entry } = useEntry(step.id);
  const settings = useStore((s) => s.settings);
  const elapsed = useStepTimer();
  useEffect(() => {
    if (entry && settings.autoplay && document.visibilityState === "visible") {
      void play(atlas.audio(entry, settings.accent), entry.w, settings.accent);
    }
  }, [entry, atlas, settings.autoplay, settings.accent]);
  const next = useCallback(() => {
    stopAudio();
    if (store.get().settings.sfx) void cue("flip");
    advance(atlas, elapsed());
  }, [atlas, elapsed]);
  useKeys({ Enter: next, " ": next });
  if (!entry) return <span className="spinner" />;
  return (
    <div className="intro">
      <p className="stage-label">
        <span className="dot dot-new" /> 初次见面
      </p>
      <EntryView entry={entry} mode="intro" />
      <footer className="learn-actions">
        <button className="btn btn-primary btn-xl" onClick={next} autoFocus>
          认识了 <ArrowRight size={20} />
        </button>
        <span className="hint-keys">
          <kbd>Enter</kbd> 继续
        </span>
      </footer>
    </div>
  );
}

const KIND_LABEL: Record<QuizKind, string> = {
  meaning: "它是什么意思？",
  picture: "看图，补全这句话",
  listen: "听，是哪个词？",
  spell: "拼出这个词",
};

function Quiz({ step, session }: { step: Step & { kind: QuizKind }; session: ActiveSession }) {
  const atlas = useAtlas();
  const ref = atlas.byId.get(step.id)!;
  const { entry } = useEntry(step.id);
  const settings = useStore((s) => s.settings);
  const accent = settings.accent;
  const pending = session.pending;
  const guidedChoice = step.guided && step.kind !== "spell";
  const elapsed = useStepTimer();
  const pronunciation = useRef<{ accent: typeof accent; done: ReturnType<typeof play>; failed: boolean } | null>(null);
  // 答对后等本题的发音播完，再进入下一题。
  const spoken = useRef<Promise<unknown> | null>(null);
  const options = useMemo(() => (step.options ?? []).map((id) => atlas.byId.get(id)!).filter(Boolean), [atlas, step.options]);

  const pronounce = useCallback((rate = 1, replay = false) => {
    if (!entry || document.visibilityState !== "visible") return null;
    const previous = pronunciation.current;
    if (!replay && previous?.accent === accent && !previous.failed) return previous.done;

    const attempt = { accent, done: play(atlas.audio(entry, accent), entry.w, accent, rate), failed: false };
    pronunciation.current = attempt;
    void attempt.done.then((result) => {
      attempt.failed = result === "stopped" || result === "unsupported";
    });
    return attempt.done;
  }, [entry, atlas, accent]);
  const replay = () => pronounce(1, true);

  const submit = useCallback(
    (value: string, correct: boolean, usedHint = false) => {
      if (pending) return;
      const ms = elapsed() * 1000;
      if (correct) {
        const el = document.querySelector<HTMLElement>(step.kind === "spell" ? ".slots" : `[data-option="${value}"]`);
        const r = el?.getBoundingClientRect();
        if (r) burst(r.left + r.width / 2, r.top + r.height / 2);
      }
      if (settings.sfx) void cue(correct ? "correct" : "wrong");
      answer(atlas, step, correct, gradeFor(step.kind, correct, ms, usedHint), value, usedHint);
      spoken.current = pronounce();
    },
    [pending, elapsed, settings.sfx, atlas, step, pronounce],
  );

  const next = useCallback(() => {
    stopAudio();
    advance(atlas, elapsed());
  }, [atlas, elapsed]);

  // 出题时读单词：听音题一定读；「什么意思」「拼写」题在开了自动发音时也读；看图补句不读（一读就把答案说出来了）
  useEffect(() => {
    const say = step.kind === "listen" || (settings.autoplay && (step.kind === "meaning" || step.kind === "spell"));
    if (say && !pending) void pronounce();
  }, [step.kind, settings.autoplay, pending, pronounce]);

  const keys: Record<string, () => void> = {};
  if (pending) {
    keys.Enter = next;
    keys[" "] = next;
  } else if (step.kind !== "spell") {
    options.forEach((o, i) => (keys[String(i + 1)] = () => submit(o.id, o.id === ref.id)));
  }
  useKeys(keys);

  if (!entry) return <span className="spinner" />;
  const sentence = entry.ex[0] ? gap(entry.ex[0].en, entry.w) : null;

  return (
    <div className={`quiz quiz-${step.kind} ${pending ? (pending.correct ? "is-right" : "is-wrong") : ""}`}>
      <p className="stage-label">
        <span className={`dot ${step.retry ? "dot-retry" : "dot-review"}`} />
        {guidedChoice ? "带提示练习 · " : step.retry ? "再见一面 · " : ""}
        {KIND_LABEL[step.kind]}
      </p>
      {guidedChoice && !pending && <p className="journey-guidance">这次从两个选项中选，可以再听一遍。</p>}

      <section className="prompt">
        {step.kind === "meaning" && (
          <div className="prompt-word">
            <h2 className="headword" lang="en">
              {entry.w}
            </h2>
            <Speak url={atlas.audio(entry, accent)} text={entry.w} accent={accent} onPlay={replay} label={<span className="ipa">{accent === "us" ? entry.us || entry.uk : entry.uk || entry.us}</span>} />
          </div>
        )}
        {step.kind === "picture" && (
          <div className="prompt-picture">
            <Illustration src={atlas.img(entry)} word={entry.w} topic={ref.topic} eager hideWord />
            <p className="cloze" lang="en">
              {sentence ? (
                <>
                  {sentence.before}
                  <span className="blank">{pending ? sentence.hidden : "　　　"}</span>
                  {sentence.after}
                </>
              ) : (
                entry.senses[0].zh
              )}
            </p>
            {sentence && pending && <p className="cloze-zh">{entry.ex[0].zh}</p>}
          </div>
        )}
        {step.kind === "listen" && (
          <div className="prompt-listen">
            <button className="listen-orb" onClick={replay} aria-label="再听一遍">
              <Volume2 size={40} strokeWidth={1.6} />
              <span />
            </button>
            <button className="link" onClick={() => pronounce(0.7, true)}>
              慢速再听
            </button>
          </div>
        )}
        {step.kind === "spell" && <SpellPrompt entry={entry} refw={ref} accent={accent} onPlay={replay} />}
      </section>

      {step.kind === "spell" ? (
        <SpellInput target={entry.w} pending={pending}
          onSubmit={(v, usedHint) => submit(v, normalize(v) === normalize(entry.w), usedHint)} />
      ) : (
        <ul className={`options ${step.kind === "meaning" ? "options-zh" : "options-en"}`}>
          {options.map((o, i) => {
            const isAnswer = o.id === ref.id;
            const chosen = pending?.value === o.id;
            const cls = pending ? (isAnswer ? "is-answer" : chosen ? "is-chosen" : "is-dim") : "";
            return (
              <li key={o.id}>
                <button className={`option ${cls}`} data-option={o.id} onClick={() => submit(o.id, isAnswer)} disabled={!!pending}>
                  <kbd>{i + 1}</kbd>
                  <span lang={step.kind === "meaning" ? "zh" : "en"}>{step.kind === "meaning" ? o.zh : o.word}</span>
                  {pending && isAnswer && <Check size={20} className="option-mark" />}
                  {pending && chosen && !isAnswer && <X size={20} className="option-mark" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {pending && <Feedback entry={entry} refw={ref} correct={pending.correct} spelling={step.kind === "spell"} onNext={next} spoken={spoken.current} />}
    </div>
  );
}

function SpellPrompt({ entry, refw, accent, onPlay }: {
  entry: Entry; refw: WordRef; accent: "uk" | "us"; onPlay: () => ReturnType<typeof play> | null;
}) {
  const atlas = useAtlas();
  const sentence = entry.ex[0] ? gap(entry.ex[0].en, entry.w) : null;
  return (
    <div className="prompt-spell">
      <Illustration src={atlas.img(entry)} word={entry.w} topic={refw.topic} eager hideWord className="spell-art" />
      <div>
        <p className="spell-zh">
          <span className="pos">{entry.senses[0].pos}</span> {entry.senses[0].zh}
        </p>
        {sentence && (
          <p className="cloze cloze-sm" lang="en">
            {sentence.before}
            <span className="blank">　　　</span>
            {sentence.after}
          </p>
        )}
        <Speak url={atlas.audio(entry, accent)} text={entry.w} accent={accent} onPlay={onPlay} size="sm" label="听发音" />
      </div>
    </div>
  );
}

/** 答对后进度条走这么久（同时读单词，读完才走），自动进下一题；答错不自动走，要学生看清后自己点继续 */
const AUTO_NEXT_MS = 1000;

function Feedback({ entry, refw, correct, spelling, onNext, spoken }: {
  entry: Entry; refw: WordRef; correct: boolean; spelling: boolean; onNext: () => void; spoken: Promise<unknown> | null;
}) {
  const atlas = useAtlas();
  const btn = useRef<HTMLButtonElement>(null);
  const [counting, setCounting] = useState(false);
  useEffect(() => btn.current?.focus({ preventScroll: true }), []);
  useEffect(() => {
    if (!correct) return;
    let alive = true;
    // 进度条马上开始走，同时读单词；两样都结束才进下一题（读音最多等 3 秒，避免没声音时卡住）
    setCounting(true);
    const read = Promise.race([spoken ?? Promise.resolve(), new Promise((r) => window.setTimeout(r, 3000))]);
    const bar = new Promise((r) => window.setTimeout(r, AUTO_NEXT_MS));
    void Promise.all([read, bar]).then(() => alive && onNext());
    return () => {
      alive = false;
    };
  }, [correct]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`feedback ${correct ? "is-right" : "is-wrong"}`} role="status">
      <div className="feedback-inner">
        <Illustration src={atlas.img(entry, "thumb")} word={entry.w} topic={refw.topic} className="feedback-art" />
        <div className="feedback-text">
          <p className="feedback-verdict">{correct ? "答对了" : spelling ? <SpellingEncouragement /> : "没关系，记住它"}</p>
          <p className="feedback-word">
            <b lang="en">{entry.w}</b>
            <span className="ipa">{entry.uk || entry.us}</span>
          </p>
          <p className="feedback-zh">
            {entry.senses
              .slice(0, 2)
              .map((s) => `${s.pos} ${s.zh}`)
              .join("　")}
          </p>
          {entry.ex[0] && (
            <p className="feedback-ex" lang="en">
              <Highlight text={entry.ex[0].en} word={entry.w} />
            </p>
          )}
        </div>
        <button
          ref={btn}
          className={`btn btn-xl ${correct ? "btn-sage" : "btn-terra"} ${counting ? "is-counting" : ""}`}
          style={{ "--auto": `${AUTO_NEXT_MS}ms` } as React.CSSProperties}
          onClick={onNext}
        >
          {correct ? "下一题" : "看清了，继续"} <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
}

function Summary({ session }: { session: ActiveSession }) {
  const atlas = useAtlas();
  const progress = useStore((s) => s.progress);
  const settings = useStore((s) => s.settings);
  const cards = progress.cards;
  const followUp = shortFollowUp(atlas, progress, settings, session);
  useEffect(() => {
    if (store.get().settings.sfx) void cue("complete");
  }, []);
  const stats = sessionStats(session);
  const { reviewCorrect, recovered } = journeyProgress(session);
  const words = [...new Set(session.steps.map((s) => s.id))].map((id) => atlas.byId.get(id)!).filter(Boolean);
  const wrong = words.filter((w) => session.graded[w.id] === Rating.Again && !recovered.includes(w.id));
  const recoveredWords = recovered.slice(0, 3).map((id) => atlas.byId.get(id)?.word).filter(Boolean);
  const next = session.pilot
    ? words.filter(({ id }) => cards[id]).sort((a, b) => cards[a.id].due - cards[b.id].due)[0]
    : undefined;
  const nextIn = next ? cards[next.id].due - Date.now() : 0;
  const practicedUnit = next && atlas.peek(next.id)?.unit;
  const minutes = Math.max(1, Math.round(((session.finished ?? Date.now()) - session.started) / 60000));
  const done = (route: Route = { page: "today" }) => {
    store.progress((p) => withSession(atlas, p, null));
    go(route);
  };
  const again = () => {
    const { progress, settings } = store.get();
    store.progress((p) => withSession(atlas, p, buildSession(atlas, progress, settings, { ids: wrong.map((w) => w.id) })));
  };
  const startFollowUp = () => {
    const { progress, settings } = store.get();
    if (sessionFor(atlas, progress)?.id !== session.id) return;
    const task = shortFollowUp(atlas, progress, settings, session);
    if (!task) return;
    const nextSession = buildSession(atlas, progress, settings, task.options);
    if (!nextSession.steps.length) return;
    window.scrollTo({ top: 0 });
    if (settings.sfx) void cue("start");
    store.progress((p) => withSession(atlas, p, nextSession));
  };
  return (
    <div className="learn summary">
      <div className="summary-card">
        <div className="summary-sky">
          <Galaxy mode="mini" highlight={words.map((w) => w.id)} ignite />
          <p>{session.pilot ? `本轮练习了 ${words.length} 个词` : `今天点亮了 ${words.length} 颗星`}</p>
        </div>
        <p className="eyebrow">{session.pilot ? "短任务完成" : "这一程结束了"}</p>
        <h1 className="display">{stats.accuracy >= 90 ? "漂亮的一程。" : stats.accuracy >= 60 ? "稳稳向前。" : "错过的，会再相遇。"}</h1>
        <div className="summary-stats">
          <Ring value={stats.accuracy / 100} size={128} tone={stats.accuracy >= 60 ? "sage" : "terra"}>
            <b>{stats.accuracy}%</b>
            <small>首次正确</small>
          </Ring>
          <dl>
            <div>
              <dt>新词</dt>
              <dd>{session.newIds.length}</dd>
            </div>
            <div>
              <dt>复习</dt>
              <dd>{session.reviewIds.length}</dd>
            </div>
            <div>
              <dt>用时</dt>
              <dd>
                {minutes}
                <small>分钟</small>
              </dd>
            </div>
          </dl>
        </div>
        {session.pilot && (
          <section className="journey-progress-card" aria-labelledby="journey-progress-title">
            <h2 id="journey-progress-title">这一程的进步</h2>
            {session.reviewIds.length > 0 && <p>到期词首次独立答对 <b>{reviewCorrect} / {session.reviewIds.length}</b> 个。</p>}
            {session.newIds.length > 0 && <p>练习了 <b>{session.newIds.length}</b> 个新词。</p>}
            {recoveredWords.length > 0 && (
              <p>后来独立答对了 <b>{recovered.length}</b> 个词，包括 <span lang="en">{recoveredWords.join("、")}</span>。</p>
            )}
            {next && (
              <p>下次可先复习 <b lang="en">{next.word}</b>
                {nextIn > 0 ? `，约 ${formatInterval(nextIn)}后到期` : "，已经到期"}。
              </p>
            )}
            {followUp && (
              <>
                <div className="summary-actions">
                  <button className="btn btn-primary btn-xl" onClick={startFollowUp} ref={(b) => b?.focus({ preventScroll: true })}>
                    {followUp.kind === "short" ? "开始下一轮短任务" : "开始巩固练习"} <ArrowRight size={20} />
                  </button>
                </div>
                <p className="muted">
                  {followUp.kind === "short"
                    ? [followUp.due && `复习 ${followUp.due} 个到期词`, followUp.fresh && `学习 ${followUp.fresh} 个新词`].filter(Boolean).join("，")
                    : `再练 ${followUp.options.ids.length} 个刚学过或复习过的词`}
                </p>
              </>
            )}
            <div className="summary-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => done({ page: "practice" })}>{settings.challenge ? "去练阅读" : "去听写"}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => done({ page: "points", unit: practicedUnit === EXTENSION_UNIT ? undefined : practicedUnit, sec: "points" })}>练课本考点</button>
              {atlas.book === "7a" && <button className="btn btn-ghost btn-sm" onClick={() => done({ page: "essays", book: "7a" })}>范文默写</button>}
            </div>
          </section>
        )}
        <ul className="summary-words">
          {words.map((w) => (
            <li key={w.id} className={session.graded[w.id] === Rating.Again && !recovered.includes(w.id) ? "is-wrong" : ""}>
              <Illustration src={atlas.img(w, "thumb")} word={w.word} topic={w.topic} />
              <span lang="en">{w.word}</span>
              <small>{w.zh}</small>
            </li>
          ))}
        </ul>
        <p className="summary-note">FSRS 已为每个词排好下次相遇的时间。答错的词，会更早回来。</p>
        <div className="summary-actions">
          {wrong.length > 0 && (
            <button className="btn btn-ghost" onClick={again}>
              <RotateCcw size={18} /> 再练 {wrong.length} 个错词
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => shareSession(atlas, session)}>
            <Share2 size={18} /> 分享成绩卡
          </button>
          <button className={followUp ? "btn btn-ghost btn-xl" : "btn btn-primary btn-xl"} onClick={() => done()} ref={followUp ? undefined : (b) => b?.focus({ preventScroll: true })}>
            {followUp ? "结束学习" : "完成"} <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Page-level shortcuts that ignore typing in inputs (except Enter, which forms handle). */
export function useKeys(map: Record<string, () => void>) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement;
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA";
      if (typing && !(e.key === "Enter" && (t as HTMLInputElement).readOnly)) return;
      if (t.tagName === "BUTTON" && (e.key === "Enter" || e.key === " ")) return;
      const fn = ref.current[e.key];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
}
