import { ArrowLeft, ArrowRight, PenLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BOOKS, bookById, bookTag } from "../lib/books";
import { essayDraftLimit, essayOpenings, gradeEssay } from "../lib/essayPractice";
import { essaysByBook, type Essay } from "../lib/essays";
import { href, type Route } from "../lib/router";
import { useStore } from "../store/store";

const essaysFor = (book: string) => essaysByBook[`../data/essays/${book}.ts`] ?? [];
const books = BOOKS.filter(({ id }) => essaysFor(id).length > 0);
const essayBookName = (id: string) => {
  const book = bookById(id);
  return book.edition ? bookTag(book.id) : book.name;
};

export default function Essays({ route }: { route: Extract<Route, { page: "essays" }> }) {
  const currentBook = useStore((s) => s.settings.book);
  const book = BOOKS.find(({ id }) => id === route.book)?.id ?? bookById(currentBook).id;
  const essays = essaysFor(book);
  const essay = essays.find(({ id }) => id === route.essay);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [book, route.essay]);

  if (essay) return <EssayDetail key={`${book}/${essay.id}`} book={book} essay={essay} />;

  return (
    <div className="page essays">
      <header className="page-head">
        <p className="eyebrow">英语写作 · {essayBookName(book)}</p>
        <h1 className="display">写作范文</h1>
        <p className="lede">按主题读范文，学会组织段落、选用句型，并把重点词句用到自己的作文里。</p>
      </header>
      {books.length > 1 && (
        <nav className="chips essay-books" aria-label="范文册数">
          {books.map(({ id }) => (
            <a
              key={id}
              className={`chip-btn ${id === book ? "is-on" : ""}`}
              aria-current={id === book ? "page" : undefined}
              href={href({ page: "essays", book: id })}
            >
              {essayBookName(id)}
            </a>
          ))}
        </nav>
      )}
      {route.essay && <p className="muted">这篇范文在当前目录中找不到。</p>}
      {essays.length ? (
        <ul className="essay-list" aria-label={`${essayBookName(book)}范文目录`}>
          {essays.map((item) => (
            <li key={item.id}>
              <a className="panel essay-card" href={href({ page: "essays", book, essay: item.id })}>
                <span className="essay-tag">{item.topic}</span>
                <h2>{item.title}</h2>
                <p className="essay-english-title" lang="en">
                  {item.englishTitle}
                </p>
                <p>{item.summary}</p>
                <span className="essay-card-link">
                  阅读、讲解与默写 <ArrowRight size={16} aria-hidden="true" />
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="panel">
          本册暂无范文。
          {books.length === 1 && (
            <a className="link" href={href({ page: "essays", book: books[0].id })}>
              查看{essayBookName(books[0].id)}范文
            </a>
          )}
        </p>
      )}
    </div>
  );
}

function EssayDetail({ essay, book }: { essay: Essay; book: string }) {
  const [version, setVersion] = useState(0);
  const [practicing, setPracticing] = useState(false);
  if (practicing) return <EssayPractice essay={essay} version={version} onExit={() => setPracticing(false)} />;

  return (
    <article className="page essays essay-detail">
      <a className="btn btn-ghost essay-back" href={href({ page: "essays", book })}>
        <ArrowLeft size={17} /> 返回范文目录
      </a>
      <header className="page-head">
        <p className="eyebrow">
          {essayBookName(book)} · {essay.topic}
        </p>
        <h1 className="display">{essay.title}</h1>
        <p className="essay-english-title" lang="en">
          {essay.englishTitle}
        </p>
        <p className="lede">{essay.summary}</p>
      </header>
      <section className="panel essay-text" aria-labelledby="essay-text-title">
        <div className="essay-section-head">
          <h2 id="essay-text-title">范文正文</h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setPracticing(true)}>
            <PenLine size={17} aria-hidden="true" /> 开始默写
          </button>
          {essay.versions.length > 1 && (
            <div className="segmented" role="group" aria-label="范文版本">
              {essay.versions.map(({ label }, i) => (
                <button
                  key={label}
                  type="button"
                  className={i === version ? "is-on" : ""}
                  aria-pressed={i === version}
                  onClick={() => setVersion(i)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="essay-paragraphs" lang="en">
          {essay.versions[version].paragraphs.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </section>
      <section className="panel essay-outline" aria-labelledby="essay-outline-title">
        <h2 id="essay-outline-title">写作思路</h2>
        <ol>
          {essay.outline.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      <section className="essay-notes" aria-labelledby="essay-grammar-title">
        <h2 id="essay-grammar-title">重点语法与句型</h2>
        <div className="essay-grammar">
          {essay.grammar.map((item) => (
            <section className="panel essay-rule" key={item.title}>
              <h3>{item.title}</h3>
              <blockquote>
                <p lang="en">{item.example}</p>
                <p>{item.translation}</p>
              </blockquote>
              <p>{item.explanation}</p>
              <p className="essay-tip">
                <b>易错提醒</b> {item.tip}
              </p>
            </section>
          ))}
        </div>
      </section>
      <section className="essay-notes" aria-labelledby="essay-vocab-title">
        <h2 id="essay-vocab-title">重点单词与短语</h2>
        <dl className="essay-vocab">
          {essay.vocabulary.map((item) => (
            <div key={item.term} className="panel">
              <dt>
                <b lang="en">{item.term}</b>
                <span>{item.meaning}</span>
              </dt>
              <dd>{item.usage}</dd>
            </div>
          ))}
        </dl>
      </section>
    </article>
  );
}

function EssayPractice({ essay, version, onExit }: { essay: Essay; version: number; onExit: () => void }) {
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<ReturnType<typeof gradeEssay> | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const verdict = useRef<HTMLHeadingElement>(null);
  const current = essay.versions[version];
  const reference = current.paragraphs.join("\n\n");
  const formats = result?.formats.map((kind) => kind === "cap" ? "大小写" : "标点");

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, []);
  useEffect(() => {
    if (!result) return;
    verdict.current?.focus({ preventScroll: true });
    verdict.current?.scrollIntoView({ block: "start" });
  }, [result]);

  return (
    <article className="page essays essay-detail essay-practice">
      <button type="button" className="btn btn-ghost essay-back" onClick={onExit}>
        <ArrowLeft size={17} aria-hidden="true" /> 返回范文
      </button>
      <header className="page-head">
        <p className="eyebrow">范文默写 · {current.label}</p>
        <h1 className="display" tabIndex={-1} ref={heading}>{essay.title}</h1>
        <p className="essay-english-title" lang="en">{essay.englishTitle}</p>
      </header>
      {result ? (
        <section className="panel essay-practice-panel" aria-labelledby="essay-result-title">
          <div role="status">
            <h2 id="essay-result-title" ref={verdict} tabIndex={-1}>{result.correct ? "默写正确" : "还有内容需要核对"}</h2>
            <p className="muted">
              {result.correct
                ? formats?.length ? `内容正确，请留意${formats.join("和")}。` : "正文与当前版本一致。"
                : `按顺序匹配了 ${result.matched} / ${result.total} 个参考词。对照高亮处核对漏写、多写或写错的内容。`}
            </p>
          </div>
          <div className="essay-comparison">
            {[
              { label: "你的默写", parts: result.draft },
              { label: "参考原文", parts: result.reference },
            ].map(({ label, parts }) => (
              <section key={label}>
                <h3>{label}</h3>
                <p lang="en">{parts.map(({ text, mark }, i) =>
                  mark ? <mark key={i} className={`essay-mark-${mark}`}>{text}</mark> : text,
                )}</p>
              </section>
            ))}
          </div>
          <div className="essay-practice-actions">
            <button type="button" className="btn btn-primary" onClick={() => setResult(null)}>修改后重交</button>
            <button type="button" className="btn btn-ghost" onClick={() => {
              setDraft("");
              setResult(null);
            }}>重新默写</button>
          </div>
        </section>
      ) : (
        <form className="panel essay-practice-panel" onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim()) setResult(gradeEssay(draft, reference));
        }}>
          <p id="essay-practice-guide" className="muted">默写所选版本的 {current.paragraphs.length} 段正文。需要时可展开提示。</p>
          <div className="essay-hints">
            <details>
              <summary>写作提纲</summary>
              <ol>{essay.outline.map((step, i) => <li key={i}>{step}</li>)}</ol>
            </details>
            <details>
              <summary>段首提示</summary>
              <ol lang="en">{essayOpenings(current.paragraphs).map((opening, i) => <li key={i}>{opening}…</li>)}</ol>
            </details>
          </div>
          <label htmlFor="essay-draft">默写正文</label>
          <textarea
            id="essay-draft"
            lang="en"
            aria-describedby="essay-practice-guide"
            placeholder="在这里默写英文正文"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={essayDraftLimit(reference)}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <div className="essay-practice-actions">
            <button type="submit" className="btn btn-primary" disabled={!draft.trim()}>提交批改</button>
          </div>
        </form>
      )}
    </article>
  );
}
