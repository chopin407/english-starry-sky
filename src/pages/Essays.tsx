import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { BOOKS, bookById } from "../lib/books";
import { essaysByBook, type Essay } from "../lib/essays";
import { href, type Route } from "../lib/router";
import { useStore } from "../store/store";

const essaysFor = (book: string) => essaysByBook[`../data/essays/${book}.ts`] ?? [];
const books = BOOKS.filter(({ id }) => essaysFor(id).length > 0);

export default function Essays({ route }: { route: Extract<Route, { page: "essays" }> }) {
  const currentBook = useStore((s) => s.settings.book);
  const book = route.book ?? (essaysFor(currentBook).length ? currentBook : (books[0]?.id ?? currentBook));
  const essays = essaysFor(book);
  const essay = essays.find(({ id }) => id === route.essay);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [book, route.essay]);

  if (essay) return <EssayDetail key={`${book}/${essay.id}`} book={book} essay={essay} />;

  return (
    <div className="page essays">
      <header className="page-head">
        <p className="eyebrow">英语写作 · {bookById(book).name}</p>
        <h1 className="display">写作范文</h1>
        <p className="lede">按主题读范文，学会组织段落、选用句型，并把重点词句用到自己的作文里。</p>
      </header>
      {books.length > 1 && (
        <nav className="chips essay-books" aria-label="范文册数">
          {books.map(({ id, name }) => (
            <a
              key={id}
              className={`chip-btn ${id === book ? "is-on" : ""}`}
              aria-current={id === book ? "page" : undefined}
              href={href({ page: "essays", book: id })}
            >
              {name}
            </a>
          ))}
        </nav>
      )}
      {route.essay && <p className="muted">这篇范文在当前目录中找不到。</p>}
      {essays.length ? (
        <ul className="essay-list" aria-label={`${bookById(book).name}范文目录`}>
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
                  阅读与讲解 <ArrowRight size={16} aria-hidden="true" />
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="panel">
          本册暂无范文。
          {books.length > 0 && (
            <a className="link" href={href({ page: "essays", book: books[0].id })}>
              查看{books[0].name}范文
            </a>
          )}
        </p>
      )}
    </div>
  );
}

function EssayDetail({ essay, book }: { essay: Essay; book: string }) {
  const [version, setVersion] = useState(0);
  return (
    <article className="page essays essay-detail">
      <a className="btn btn-ghost essay-back" href={href({ page: "essays", book })}>
        <ArrowLeft size={17} /> 返回范文目录
      </a>
      <header className="page-head">
        <p className="eyebrow">
          {bookById(book).name} · {essay.topic}
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
