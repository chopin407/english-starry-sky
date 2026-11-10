import { Crosshair, Minus, Move, Orbit, Plus, RotateCcw, Share2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAtlas } from "../atlas/context";
import type { WordRef } from "../atlas/types";
import { openWord } from "../lib/router";
import { cue, playFile } from "../lib/sound";
import { isMastered } from "../store/srs";
import { store, useStore } from "../store/store";
import { Illustration } from "../ui/Illustration";
import { detectQuality, GalaxyEngine } from "./engine";
import { constellationStars, layoutGalaxy, TOPIC_COLORS, type GalaxyLayout } from "./layout";
import { unitKey } from "../lib/unit";
import { shareGalaxy } from "./share";
import { GalaxyFx } from "./GalaxyFx";

const layouts = new WeakMap<object, GalaxyLayout>();
export function useGalaxyLayout() {
  const atlas = useAtlas();
  return useMemo(() => {
    let l = layouts.get(atlas);
    if (!l) {
      l = layoutGalaxy(atlas);
      layouts.set(atlas, l);
    }
    return l;
  }, [atlas]);
}

const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

type Point = { x: number; y: number };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const dragThreshold = (pointerType: string) => pointerType === "mouse" ? 8 : 12;

/** Brightness of every star from the learner's memory state. */
function starStates(layout: GalaxyLayout, cards: Record<string, { st: number; s: number } | undefined>, highlight?: Set<string>) {
  const out = new Float32Array(layout.n);
  layout.ids.forEach((id, i) => {
    if (highlight?.has(id)) out[i] = 3;
    else {
      const c = cards[id];
      out[i] = c ? (isMastered(c as never) ? 2 : 1) : 0;
    }
  });
  return out;
}

export function Galaxy({
  mode = "full",
  highlight,
  ignite,
  className = "",
  focus,
}: {
  mode?: "full" | "mini";
  /** Words to show as today's gold stars. */
  highlight?: string[];
  /** Light the highlighted stars one by one (session summary). */
  ignite?: boolean;
  className?: string;
  /** Fly to this word once ready. */
  focus?: string | null;
}) {
  const atlas = useAtlas();
  const layout = useGalaxyLayout();
  const cards = useStore((s) => s.progress.cards);
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<GalaxyEngine | null>(null);
  const labels = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ ref: WordRef; x: number; y: number } | null>(null);
  const [rotating, setRotating] = useState(false);
  const [fallback, setFallback] = useState(false);
  const highlightSet = useMemo(() => new Set(highlight ?? []), [highlight]);
  // 连成了的星座：一个单元的词全部点亮后，挑几颗星连成线
  const formed = useStore((s) => s.progress.game.constellations);
  const cons = useMemo(
    () =>
      atlas.cefr
        .map((name, u) => ({ name, key: unitKey(atlas.book, name), u }))
        .filter((c) => formed.includes(c.key))
        .map((c) => ({ ...c, stars: constellationStars(layout, atlas.words.flatMap((w, i) => (w.cefr === c.u ? [i] : []))) })),
    [atlas, layout, formed],
  );
  const consRef = useRef(cons);
  consRef.current = cons;
  const consSvg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const eng = new GalaxyEngine(cv, layout, {
      quality: detectQuality(),
      reducedMotion: reduced(),
      preserve: mode === "full",
      autoRotate: mode === "mini" ? 0.06 : 0,
    });
    engine.current = eng;
    setFallback(!eng.webgl);
    eng.resize();
    if (mode === "mini") eng.cam.dist = eng.baseDist() * 1.1;
    const ro = new ResizeObserver(() => eng.resize());
    ro.observe(cv);
    // Only animate while visible.
    const io = new IntersectionObserver(([e]) => (e.isIntersecting && !document.hidden ? eng.start() : eng.stop()));
    io.observe(cv);
    const vis = () => (document.hidden ? eng.stop() : eng.start());
    document.addEventListener("visibilitychange", vis);
    if (mode === "full") {
      eng.onFrame = () => {
        const box = labels.current;
        if (!box) return;
        const kids = box.children as HTMLCollectionOf<HTMLElement>;
        layout.topicCenters.forEach(([x, y, z], t) => {
          const el = kids[t];
          const p = eng.toScreen(x, y, z);
          if (!el) return;
          if (!p) {
            el.style.opacity = "0";
            return;
          }
          el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
          el.style.opacity = String(Math.max(0, Math.min(0.9, 3.4 - p.depth)));
        });
        const svg = consSvg.current;
        if (!svg) return;
        const P = layout.positions;
        consRef.current.forEach((c, k) => {
          const g = svg.children[k] as SVGGElement | undefined;
          if (!g) return;
          const pts = c.stars.map((i) => eng.toScreen(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]));
          if (pts.some((p) => !p)) {
            g.style.opacity = "0";
            return;
          }
          const ok = pts as { x: number; y: number; depth: number }[];
          g.style.opacity = String(Math.max(0, Math.min(1, 3.6 - ok[0].depth)));
          g.children[0].setAttribute("points", ok.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "));
          ok.forEach((p, j) => {
            const dot = g.children[1 + j];
            dot?.setAttribute("cx", p.x.toFixed(1));
            dot?.setAttribute("cy", p.y.toFixed(1));
          });
          const label = g.lastElementChild!;
          label.setAttribute("x", ok[0].x.toFixed(1));
          label.setAttribute("y", (ok[0].y - 12).toFixed(1));
        });
      };
    }
    return () => {
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", vis);
      eng.destroy();
      engine.current = null;
    };
  }, [layout, mode]);

  // Brightness follows memory state; in ignite mode today's stars start dark.
  useEffect(() => {
    const eng = engine.current;
    if (!eng) return;
    const states = starStates(layout, cards, ignite ? undefined : highlightSet);
    if (ignite) highlightSet.forEach((id) => {
      const i = layout.index.get(id);
      if (i !== undefined) states[i] = 0;
    });
    eng.setStates(states);
  }, [layout, cards, highlightSet, ignite]);

  // Session summary: stars light up one after another, then a soft voice line.
  useEffect(() => {
    const eng = engine.current;
    if (!eng || !ignite || !highlightSet.size) return;
    const ids = [...highlightSet].filter((id) => layout.index.has(id));
    eng.frameStars(ids.map((id) => layout.index.get(id)!));
    eng.autoRotate = 0.02;
    const sfx = store.get().settings.sfx;
    const timers = ids.map((id, k) =>
      window.setTimeout(() => {
        eng.setState(layout.index.get(id)!, 3);
        if (sfx && k < 12) void cue("ignite");
      }, 1400 + k * 180),
    );
    const voice = window.setTimeout(() => sfx && void playFile("voice-galaxy-lit.mp3", 0.9), 1600 + ids.length * 180);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(voice);
    };
  }, [ignite, highlightSet, layout]);

  useEffect(() => {
    if (!focus) return;
    const i = layout.index.get(focus);
    if (i !== undefined) {
      engine.current?.flyTo(i);
      if (store.get().settings.sfx) void cue("fly");
    }
  }, [focus, layout]);

  // First visit to the full galaxy: one quiet sentence explaining what it is.
  useEffect(() => {
    if (mode !== "full") return;
    try {
      if (localStorage.getItem("word-atlas:galaxy-hello")) return;
      localStorage.setItem("word-atlas:galaxy-hello", "1");
    } catch {
      return;
    }
    const t = window.setTimeout(() => store.get().settings.sfx && void playFile("voice-galaxy-hello.mp3", 0.9), 900);
    return () => clearTimeout(t);
  }, [mode]);

  /* ---------- interaction (full mode) ---------- */
  const drag = useRef<{ start: Point; moved: boolean; rotate: boolean } | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const lastTwinkle = useRef(0);
  const dwell = useRef(0);
  const openTimer = useRef(0);
  useEffect(() => () => {
    window.clearTimeout(dwell.current);
    window.clearTimeout(openTimer.current);
  }, [layout, mode]);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const clearHover = () => {
    window.clearTimeout(dwell.current);
    if (engine.current) engine.current.hover = -1;
    setHover(null);
  };

  const onMove = (e: React.PointerEvent) => {
    const eng = engine.current;
    if (!eng) return;
    const p = local(e);
    const ps = pointers.current;
    const prev = ps.get(e.pointerId);
    const gesture = drag.current;
    if (prev && gesture) {
      ps.set(e.pointerId, p);
      if (ps.size === 2) {
        const other = [...ps.entries()].find(([id]) => id !== e.pointerId)![1];
        const before = distance(prev, other);
        const after = distance(p, other);
        if (before > 0 && after > 0) eng.zoom(before / after);
        eng.pan((p.x - prev.x) / 2, (p.y - prev.y) / 2);
      } else if (ps.size === 1) {
        const from = gesture.moved ? prev : gesture.start;
        if (!gesture.moved && distance(p, from) <= dragThreshold(e.pointerType)) return;
        if (!gesture.moved) clearHover();
        gesture.moved = true;
        const dx = p.x - from.x;
        const dy = p.y - from.y;
        if (gesture.rotate) eng.rotate(dx, dy);
        else eng.pan(dx, dy);
      }
      return;
    }
    if (e.pointerType !== "mouse") return;
    // Only reveal a star once the cursor rests on it, so sweeping across the
    // galaxy doesn't flicker through dozens of cards (and sounds).
    const i = eng.pick(p.x, p.y);
    eng.hover = i;
    window.clearTimeout(dwell.current);
    if (i < 0) {
      dwell.current = window.setTimeout(() => setHover(null), 260);
      return;
    }
    const ref = atlas.words[i];
    if (hover?.ref.id === ref.id) return;
    dwell.current = window.setTimeout(() => {
      setHover({ ref, x: p.x, y: p.y });
      const now = performance.now();
      if (store.get().settings.sfx && now - lastTwinkle.current > 400) {
        lastTwinkle.current = now;
        void cue("twinkle");
      }
    }, 120);
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    window.clearTimeout(dwell.current);
    window.clearTimeout(openTimer.current);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (drag.current) {
      // A gesture with multiple pointers can never select a star on release.
      drag.current.moved = true;
      clearHover();
    } else {
      drag.current = { start: p, moved: false, rotate: rotating || e.shiftKey };
    }
  };

  const endPointer = (e: React.PointerEvent) => {
    if (!pointers.current.delete(e.pointerId)) return null;
    const gesture = drag.current;
    if (pointers.current.size) return null;
    drag.current = null;
    return gesture;
  };

  const onUp = (e: React.PointerEvent) => {
    const gesture = endPointer(e);
    const eng = engine.current;
    if (!eng || !gesture || gesture.moved) return;
    const p = local(e);
    if (distance(p, gesture.start) > dragThreshold(e.pointerType)) return;
    const i = eng.pick(p.x, p.y, e.pointerType === "mouse" ? 16 : 26);
    if (i < 0) return;
    const ref = atlas.words[i];
    eng.flyTo(i);
    if (store.get().settings.sfx) void cue("fly");
    openTimer.current = window.setTimeout(() => openWord(ref.id), 350);
  };

  const onWheel = (e: React.WheelEvent) => {
    const eng = engine.current;
    if (!eng) return;
    clearHover();
    eng.zoom(Math.exp(e.deltaY * 0.0012));
  };

  useEffect(() => {
    // Wheel zoom must not scroll the page while over the galaxy.
    const cv = canvas.current;
    if (!cv || mode !== "full") return;
    const stop = (e: WheelEvent) => e.preventDefault();
    cv.addEventListener("wheel", stop, { passive: false });
    return () => cv.removeEventListener("wheel", stop);
  }, [mode]);

  const lit = useMemo(() => layout.ids.reduce((n, id) => n + (cards[id] ? 1 : 0), 0), [layout, cards]);

  if (mode === "mini")
    return (
      <div className={`galaxy galaxy-mini ${className}`}>
        <canvas ref={canvas} aria-hidden="true" />
        {fallback && <span className="galaxy-fallback" />}
        <GalaxyFx />
      </div>
    );

  return (
    <div className={`galaxy galaxy-full ${className}`}>
      <canvas
        ref={canvas}
        onPointerMove={onMove}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={endPointer}
        onLostPointerCapture={endPointer}
        onPointerLeave={clearHover}
        onWheel={onWheel}
        role="img"
        aria-label={`词汇星图，${layout.n} 颗星，已点亮 ${lit} 颗。可拖动${rotating ? "旋转" : "平移"}，用方向键平移，用滚轮或双指缩放，点按星星打开词条。`}
        tabIndex={0}
        onKeyDown={(e) => {
          const eng = engine.current;
          if (!eng) return;
          switch (e.key) {
            case "ArrowLeft": eng.pan(-48, 0); break;
            case "ArrowRight": eng.pan(48, 0); break;
            case "ArrowUp": eng.pan(0, -48); break;
            case "ArrowDown": eng.pan(0, 48); break;
            case "+":
            case "=": eng.zoom(0.85); break;
            case "-": eng.zoom(1.18); break;
            default: return;
          }
          e.preventDefault();
          clearHover();
        }}
      />
      <GalaxyFx />
      <svg className="galaxy-cons" ref={consSvg} aria-hidden="true">
        {cons.map((c) => (
          <g key={c.key}>
            <polyline />
            {c.stars.map((i) => (
              <circle key={i} r={2.6} />
            ))}
            <text textAnchor="middle">{c.name}</text>
          </g>
        ))}
      </svg>
      <div className="galaxy-labels" ref={labels} aria-hidden="true">
        {atlas.topics.map(([key, name], t) => (
          <span key={key} style={{ "--c": TOPIC_COLORS[t % TOPIC_COLORS.length] } as React.CSSProperties}>
            {name}
          </span>
        ))}
      </div>
      {hover && (
        <button
          className="galaxy-tip"
          style={{ transform: `translate(${Math.min(hover.x + 18, (canvas.current?.clientWidth ?? 0) - 260)}px, ${Math.max(8, hover.y - 46)}px)` }}
          onClick={() => openWord(hover.ref.id)}
        >
          <Illustration src={atlas.img(hover.ref, "thumb")} word={hover.ref.word} topic={hover.ref.topic} />
          <span>
            <b lang="en">{hover.ref.word}</b>
            <small>{hover.ref.zh}</small>
          </span>
        </button>
      )}
      <div className="galaxy-hud">
        <p>
          <b>{lit.toLocaleString()}</b> / {layout.n.toLocaleString()} 颗星已点亮
        </p>
        <p className="galaxy-cons-count">
          星座 <b>{cons.length}</b> / {atlas.cefr.length} · 一个单元的词全部点亮，就连成一个星座
        </p>
        <ul className="galaxy-legend" aria-hidden="true">
          <li>
            <i className="lg-dust" />
            未学
          </li>
          <li>
            <i className="lg-learning" />
            学习中
          </li>
          <li>
            <i className="lg-mastered" />
            已掌握
          </li>
        </ul>
      </div>
      <div className="galaxy-controls">
        <button className="icon-btn" onClick={() => engine.current?.zoom(0.8)} aria-label="放大">
          <Plus size={18} />
        </button>
        <button className="icon-btn" onClick={() => engine.current?.zoom(1.25)} aria-label="缩小">
          <Minus size={18} />
        </button>
        <button
          className="icon-btn"
          onClick={() => {
            engine.current?.reset();
            engine.current?.replayIntro();
            setRotating(false);
            if (store.get().settings.sfx) void cue("fly");
          }}
          aria-label="回到全景"
        >
          <RotateCcw size={17} />
        </button>
        <button
          className="icon-btn"
          onClick={() => {
            const ids = Object.keys(cards);
            const pick = ids[Math.floor(Math.random() * ids.length)] ?? atlas.words[0].id;
            const i = layout.index.get(pick);
            if (i !== undefined) {
              engine.current?.flyTo(i);
              if (store.get().settings.sfx) void cue("fly");
            }
          }}
          aria-label="飞到一颗已点亮的星"
        >
          <Crosshair size={17} />
        </button>
        <button className="icon-btn" onClick={() => canvas.current && shareGalaxy(canvas.current, lit, layout.n)} aria-label="分享我的星图">
          <Share2 size={17} />
        </button>
      </div>
      <div className="galaxy-footer">
        <div className="galaxy-mode" role="group" aria-label="星图拖动模式">
          <button type="button" aria-pressed={!rotating} onClick={() => setRotating(false)}><Move size={15} aria-hidden="true" /> 平移</button>
          <button type="button" aria-pressed={rotating} onClick={() => setRotating(true)}><Orbit size={15} aria-hidden="true" /> 旋转</button>
        </div>
        <p className="galaxy-hint">拖动{rotating ? "旋转" : "平移"} · 滚轮或双指缩放 · 点按星星打开词条</p>
      </div>
    </div>
  );
}
