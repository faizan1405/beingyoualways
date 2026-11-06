import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import before from "@/assets/hero-pig-before.jpg";
import after from "@/assets/hero-pig-after.jpg";

const DEMO_KEY = "bya.heroDemoPlayed";

/** Keyframes for the one-time demo: centre → reveal Before → reveal After → centre (~3.6s). */
const DEMO = [
  { to: 92, ms: 1100 },
  { to: 8, ms: 1600 },
  { to: 50, ms: 900 },
];
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function BeforeAfter() {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [demo, setDemo] = useState(false);
  const cancelRef = useRef<() => void>(() => {});

  const stopDemo = useCallback(() => { cancelRef.current(); }, []);

  // One-time automatic demonstration per session; skipped for reduced motion.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try { if (sessionStorage.getItem(DEMO_KEY)) return; } catch { /* storage blocked */ }

    let raf = 0;
    let timer = 0;
    let cancelled = false;
    const cancel = () => {
      if (cancelled) return;
      cancelled = true;
      cancelAnimationFrame(raf); clearTimeout(timer);
      setDemo(false);
      document.removeEventListener("visibilitychange", onVis);
    };
    const onVis = () => { if (document.hidden) { cancel(); setPos(50); } };
    cancelRef.current = cancel;

    const run = (step: number, from: number) => {
      const seg = DEMO[step];
      if (!seg || cancelled) { cancel(); return; }
      const start = performance.now();
      const tick = (now: number) => {
        if (cancelled) return;
        const t = Math.min(1, (now - start) / seg.ms);
        setPos(from + (seg.to - from) * ease(t));
        if (t < 1) raf = requestAnimationFrame(tick);
        else run(step + 1, seg.to);
      };
      raf = requestAnimationFrame(tick);
    };

    timer = window.setTimeout(() => {
      try { sessionStorage.setItem(DEMO_KEY, "1"); } catch { /* ignore */ }
      setDemo(true);
      document.addEventListener("visibilitychange", onVis);
      run(0, 50);
    }, 1200);
    return cancel;
  }, []);

  const move = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos(Math.min(97, Math.max(3, ((clientX - r.left) / r.width) * 100)));
  }, []);

  return (
    <div
      ref={ref}
      className="ba-wrap group relative h-full w-full select-none overflow-hidden rounded-[1.75rem] bg-secondary shadow-[var(--shadow-soft,0_30px_60px_-30px_rgba(0,0,0,0.35))] touch-pan-y"
      onPointerDown={(e) => { stopDemo(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); setDragging(true); move(e.clientX); }}
      onPointerMove={(e) => dragging && move(e.clientX)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onWheel={stopDemo}
    >
      <img src={after} alt="Illustrative after: more even-looking skin tone with reduced pigmentation" width={1024} height={1280} draggable={false} className="absolute inset-0 h-full w-full object-cover object-[50%_30%]" />
      <img
        src={before}
        alt="Illustrative before: skin with dark spots and uneven tone"
        width={1024}
        height={1280}
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover object-[50%_30%]"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />
      <span className="absolute left-4 top-4 rounded-full bg-background/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground backdrop-blur">Before</span>
      <span className="absolute right-4 top-4 rounded-full bg-background/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground backdrop-blur">After</span>
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }}>
        <div className="absolute inset-y-0 -translate-x-1/2 w-px bg-background/90" />
      </div>
      <button
        type="button"
        role="slider"
        aria-label="Compare before and after skin"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        aria-valuetext={`${Math.round(pos)}% before shown`}
        onFocus={stopDemo}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") { e.preventDefault(); stopDemo(); setPos((p) => Math.max(3, p - 5)); }
          if (e.key === "ArrowRight") { e.preventDefault(); stopDemo(); setPos((p) => Math.min(97, p + 5)); }
        }}
        data-demo={demo || undefined}
        className="ba-handle absolute top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-background/70 bg-background/85 text-primary backdrop-blur transition-[box-shadow,transform] duration-300 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent data-[demo]:shadow-[0_0_0_8px_color-mix(in_oklab,var(--background)_35%,transparent)]"
        style={{ left: `${pos}%` }}
      >
        <ChevronLeft className="size-4" /><ChevronRight className="-ml-1 size-4" />
      </button>
      <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-[10px] uppercase tracking-[0.2em] text-background/90">Drag to compare · Illustrative imagery — not actual product results</p>
    </div>
  );
}
