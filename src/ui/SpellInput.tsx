import { Lightbulb } from "lucide-react";
import { useRef, useState } from "react";
import { same } from "../lib/typing";

type Props = {
  target: string;
  pending?: { correct: boolean; value: string };
  onSubmit: (value: string, usedHint: boolean) => void;
};

export function SpellInput({ target, pending, onSubmit }: Props) {
  const [value, setValue] = useState("");
  const [caret, setCaret] = useState(0);
  const [usedHint, setUsedHint] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const shown = pending?.value ?? value;
  const words = target.split(/\s+/);
  const typedWords = shown.split(/\s/);
  const beforeCaret = value.slice(0, caret).split(/\s/);
  const caretWord = beforeCaret.length - 1;
  const caretSlot = Array.from(beforeCaret[caretWord]).length;

  const chars = Array.from(target);
  const typedChars = Array.from(value);
  const firstMissing = chars.findIndex((char, i) => !same(char, typedChars[i] ?? ""));
  const nextLetter = firstMissing < 0 ? -1 : chars.findIndex((char, i) => i >= firstMissing && /\p{L}/u.test(char));
  const canHint = nextLetter >= 0 && chars.slice(nextLetter + 1).some((char) => /\p{L}/u.test(char));

  const hint = () => {
    const prefix = chars.slice(0, nextLetter + 1).join("");
    setValue(prefix);
    setCaret(prefix.length);
    setUsedHint(true);
    input.current?.focus();
  };

  return (
    <form
      className="spell"
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending && value.trim()) onSubmit(value, usedHint);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.repeat) e.preventDefault();
      }}
    >
      <div className="spell-entry">
        <div className="slots" aria-hidden="true">
          {Array.from({ length: Math.max(words.length, typedWords.length) }, (_, wordIndex) => {
            const expected = Array.from(words[wordIndex] ?? "");
            const typed = Array.from(typedWords[wordIndex] ?? "");
            const slotCount = Math.max(expected.length, typed.length);
            if (!slotCount) return null;
            return (
              <span className="slot-group" key={wordIndex}>
                {Array.from({ length: slotCount }, (_, i) => {
                  const active = !pending && wordIndex === caretWord && i === Math.min(caretSlot, slotCount - 1);
                  const state = pending ? (same(typed[i] ?? "", expected[i] ?? "") ? "is-ok" : "is-bad") : typed[i] ? "is-filled" : "";
                  return (
                    <span key={i} className={`slot ${state} ${active ? "is-caret" : ""}`}>
                      {pending && !pending.correct ? expected[i] ?? typed[i] : typed[i]}
                    </span>
                  );
                })}
              </span>
            );
          })}
        </div>
        <input
          ref={input}
          className="spell-input"
          lang="en"
          value={shown}
          onChange={(e) => {
            setValue(e.currentTarget.value);
            setCaret(e.currentTarget.selectionStart ?? e.currentTarget.value.length);
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
          maxLength={Math.max(128, target.length * 2)}
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-label="拼写答案"
          readOnly={!!pending}
        />
      </div>
      {!pending && (
        <div className="spell-actions">
          <button type="button" className="btn btn-ghost" onClick={hint} disabled={!canHint}>
            <Lightbulb size={17} /> 提示字母
          </button>
          <button type="submit" className="btn btn-primary" disabled={!value.trim()}>
            确认 <kbd>Enter</kbd>
          </button>
        </div>
      )}
    </form>
  );
}
