import { Lightbulb } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { same, SPELL_GAP, spellSlotEdit } from "../lib/typing";

type Props = {
  target: string;
  pending?: { correct: boolean; value: string };
  onSubmit: (value: string, usedHint: boolean) => void;
};

export function SpellInput({ target, pending, onSubmit }: Props) {
  const [value, setValue] = useState("");
  const [caret, setCaret] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [focused, setFocused] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const activeSlot = useRef<HTMLSpanElement>(null);
  const revealActive = useRef<(() => void) | null>(null);
  const shown = pending?.value ?? value;
  const words = target.split(/\s+/);
  const typedWords = shown.split(/\s/);
  const beforeCaret = value.slice(0, caret).split(/\s/);
  const caretWord = beforeCaret.length - 1;
  const caretSlot = Array.from(beforeCaret[caretWord]).length;
  const answer = value.replaceAll(SPELL_GAP, "");

  function alignInput(slot: HTMLElement) {
    const field = input.current;
    if (!field) return;
    field.style.top = `${slot.offsetTop}px`;
    field.style.left = `${slot.offsetLeft}px`;
    field.style.height = `${slot.offsetHeight}px`;
  }

  useLayoutEffect(() => {
    if (activeSlot.current) alignInput(activeSlot.current);
    revealActive.current?.();
  });

  useEffect(() => {
    if (!focused || pending) return;
    const viewport = window.visualViewport;
    const spell = form.current;
    let frame = 0;
    const scrollToActive = () => {
      const slot = activeSlot.current;
      if (!slot) return;
      alignInput(slot);
      const rect = slot.getBoundingClientRect();
      const top = (viewport?.offsetTop ?? 0) + (document.querySelector(".topbar")?.getBoundingClientRect().height ?? 0) + 12;
      const bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 16;
      if (rect.bottom > bottom) window.scrollBy({ top: rect.bottom - bottom });
      else if (rect.top < top) window.scrollBy({ top: rect.top - top });
    };
    const reveal = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const covered = viewport?.scale === 1 ? Math.max(0, document.documentElement.clientHeight - viewport.height) : 0;
        const space = `${covered}px`;
        if (spell && spell.style.getPropertyValue("--spell-occlusion") !== space) {
          spell.style.setProperty("--spell-occlusion", space);
          // Wait for the added scroll space before moving the active row.
          frame = requestAnimationFrame(scrollToActive);
        } else scrollToActive();
      });
    };
    revealActive.current = reveal;
    reveal();
    viewport?.addEventListener("resize", reveal);
    return () => {
      cancelAnimationFrame(frame);
      revealActive.current = null;
      spell?.style.removeProperty("--spell-occlusion");
      viewport?.removeEventListener("resize", reveal);
    };
  }, [focused, pending]);

  const focusSlot = (slot: HTMLElement, wordIndex: number, slotIndex: number) => {
    const field = input.current;
    if (!field || pending) return;
    const edit = spellSlotEdit(value, words, wordIndex, slotIndex);
    alignInput(slot);
    field.focus({ preventScroll: true });
    field.value = edit.value;
    field.setSelectionRange(edit.start, edit.end);
    setValue(edit.value);
    setCaret(edit.start);
  };

  const chars = Array.from(target);
  const typedChars = Array.from(value);
  const firstMissing = chars.findIndex((char, i) => !same(char, typedChars[i] ?? ""));
  const nextLetter = firstMissing < 0 ? -1 : chars.findIndex((char, i) => i >= firstMissing && /\p{L}/u.test(char));
  const hintLimit = Math.floor(chars.filter((char) => /\p{L}/u.test(char)).length / 2);
  const hintsLeft = Math.max(0, hintLimit - hintsUsed);
  const canHint = hintsLeft > 0 && nextLetter >= 0 && chars.slice(nextLetter + 1).some((char) => /\p{L}/u.test(char));

  const hint = () => {
    if (!canHint) return;
    const prefix = chars.slice(0, nextLetter + 1).join("");
    setValue(prefix);
    setCaret(prefix.length);
    setHintsUsed((used) => used + 1);
    input.current?.focus();
  };

  return (
    <form
      ref={form}
      className={`spell ${target.length >= 24 ? "is-long" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending && answer.trim()) onSubmit(answer, hintsUsed > 0);
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
                  const letter = typed[i] === SPELL_GAP ? "" : typed[i];
                  const state = pending ? (same(letter ?? "", expected[i] ?? "") ? "is-ok" : "is-bad") : letter ? "is-filled" : "";
                  return (
                    <span key={i} ref={active ? activeSlot : undefined} className={`slot ${state} ${active ? "is-caret" : ""}`}
                      onClick={(event) => focusSlot(event.currentTarget, wordIndex, i)}>
                      {pending && !pending.correct ? expected[i] ?? letter : letter}
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
            const field = e.currentTarget;
            const index = field.selectionStart ?? field.value.length;
            const inserted = field.value.length - value.length;
            let next = field.value;
            const event = e.nativeEvent as InputEvent;
            if (event.inputType === "insertText" && !event.isComposing && inserted > 0) {
              let end = index;
              while (end < index + inserted && next[end] === SPELL_GAP) end++;
              if (end !== index) {
                next = next.slice(0, index) + next.slice(end);
                field.value = next;
                field.setSelectionRange(index, index);
              }
            }
            setValue(next);
            setCaret(index);
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={Math.max(128, target.length * 2)}
          autoFocus={!window.matchMedia("(pointer: coarse)").matches}
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
            <Lightbulb size={17} /> 提示字母（剩 {hintsLeft} 次）
          </button>
          <button type="submit" className="btn btn-primary" disabled={!answer.trim()}>
            确认 <kbd>Enter</kbd>
          </button>
        </div>
      )}
    </form>
  );
}
