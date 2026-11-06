import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { productImages } from "@/lib/product-images";

type Stage = { k: string; title: string; copy: string; src: string | undefined; alt: string; bg: string; fg: string; muted: string; cta?: boolean };

export const stages: Stage[] = [
  { k: "Discover", title: "Discover the beauty of nature.", copy: "Thoughtful beauty begins with inspiration from the natural world.", src: productImages("toner")[0], alt: "Being You toner among fresh fennel flowers", bg: "var(--background)", fg: "var(--foreground)", muted: "var(--muted-foreground)" },
  { k: "Care", title: "Make every moment a ritual.", copy: "Discover skincare designed to make everyday care feel personal.", src: productImages("face-serum")[0], alt: "Being You face serum", bg: "color-mix(in oklab, var(--sage) 70%, var(--background))", fg: "var(--sage-foreground)", muted: "color-mix(in oklab, var(--sage-foreground) 75%, transparent)" },
  { k: "Nourish", title: "Care that goes beyond the surface.", copy: "Make room for thoughtful haircare in your everyday routine.", src: productImages("hair-oil")[0], alt: "Being You hair oil", bg: "var(--primary)", fg: "var(--primary-foreground)", muted: "color-mix(in oklab, var(--primary-foreground) 75%, transparent)" },
  { k: "Express", title: "Express the beauty of being you.", copy: "Explore colour, creativity and the confidence to embrace your individuality.", src: productImages("liquid-matte-lipstick")[1], alt: "Being You liquid matte lipstick", bg: "color-mix(in oklab, var(--accent) 55%, var(--background))", fg: "var(--foreground)", muted: "color-mix(in oklab, var(--foreground) 75%, transparent)", cta: true },
];

const mix = (a: string, b: string, t: number) => `color-mix(in oklab, ${a} ${((1 - t) * 100).toFixed(1)}%, ${b})`;
const ease = (t: number) => t * t * (3 - 2 * t);
const clamp = (v: number) => Math.min(1, Math.max(0, v));

/** Map 0–1 section progress to stage index + blend toward the next stage. Exported for tests. */
export function stageAt(p: number, n = stages.length) {
  const x = Math.min(n - 1, Math.max(0, p * (n - 1)));
  const i = Math.floor(x);
  const blend = ease(clamp((x - i - 0.25) / 0.5));
  return { i, blend, active: Math.min(n - 1, Math.round(i + blend)) };
}

/** Section progress while it passes through the viewport (normal flow, no pinning). Exported for tests. */
export function sectionProgress(top: number, height: number, vh: number) {
  // starts when the section top reaches 25% down the screen, ends when its bottom reaches 75%
  return clamp((vh * 0.25 - top) / Math.max(1, height - vh * 0.5));
}

/** "The Beauty of Being You" — four stages slide right→left as the page scrolls vertically. No scroll locking or wheel interception. */
export function ScrollStory() {
  const ref = useRef<HTMLElement>(null);
  const [p, setP] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        setP(sectionProgress(r.top, r.height, window.innerHeight));
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, []);

  /** Keyboard/button navigation: scrolls the page (not the section) to where that stage is shown. */
  const goTo = (n: number) => {
    const el = ref.current;
    if (!el) return;
    const target = Math.min(stages.length - 1, Math.max(0, n)) / (stages.length - 1);
    const vh = window.innerHeight;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const y = top - vh * 0.25 + target * (el.offsetHeight - vh * 0.5);
    window.scrollTo({ top: y, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  const { i, blend, active } = stageAt(p);
  const a = stages[i]!, b = stages[Math.min(stages.length - 1, i + 1)]!;
  const bg = mix(a.bg, b.bg, blend), fg = mix(a.fg, b.fg, blend), muted = mix(a.muted, b.muted, blend);
  const x = p * (stages.length - 1); // 0 → 3 panels travelled

  return (
    <section ref={ref} aria-label="The beauty of being you" className="story relative" style={{ backgroundColor: bg, color: fg }} data-stage={stages[active]!.k}>
      {/* Desktop/tablet: horizontal track moved by vertical scroll */}
      <div className="hidden py-24 md:block">
        <div className="container-lux flex items-end justify-between gap-6">
          <div>
            <p className="eyebrow" style={{ color: muted }}>The beauty of being you</p>
            <p className="mt-3 font-serif text-2xl italic" style={{ color: muted }}>A journey in four rituals</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => goTo(active - 1)} disabled={active === 0} aria-label="Previous stage" className="grid h-11 w-11 place-items-center rounded-full border border-current/30 transition-opacity disabled:opacity-30"><ArrowLeft className="h-4 w-4" /></button>
            <button type="button" onClick={() => goTo(active + 1)} disabled={active === stages.length - 1} aria-label="Next stage" className="grid h-11 w-11 place-items-center rounded-full border border-current/30 transition-opacity disabled:opacity-30"><ArrowRight className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="mt-12 overflow-hidden">
          <div className="story-track flex will-change-transform" style={{ transform: `translate3d(calc(${(-x * 72).toFixed(3)}vw), 0, 0)` }}>
            {stages.map((s, n) => {
              const d = x - n; // 0 when centred
              const on = n === active;
              return (
                <article key={s.k} aria-hidden={!on} className="story-panel grid w-[72vw] shrink-0 grid-cols-[1fr_0.9fr] items-center gap-10 pl-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))] pr-6" data-on={on || undefined}>
                  <div className="story-text relative" data-on={on || undefined}>
                    <p className="story-line font-serif text-xl italic" style={{ color: muted }}>0{n + 1} — {s.k}</p>
                    <h2 className="story-line mt-3 text-5xl leading-[1.05] lg:text-6xl" style={{ color: fg }}>{s.title}</h2>
                    <p className="story-line mt-5 max-w-md text-[15px] leading-relaxed" style={{ color: muted }}>{s.copy}</p>
                    {s.cta && (
                      <Link to="/shop" tabIndex={on ? 0 : -1} className="story-line mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5">
                        Explore the Collection <ArrowRight className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                  <div className="relative aspect-[4/5] max-h-[68vh] w-full overflow-hidden rounded-[2rem] shadow-[var(--shadow-soft)]">
                    <img src={s.src} alt={on ? s.alt : ""} loading="lazy" decoding="async" data-on={on || undefined}
                      className="story-img absolute inset-0 h-full w-full object-cover"
                      style={{ transform: `scale(${(1.08 - Math.min(1, Math.abs(d)) * -0.02).toFixed(3)}) translate3d(${(d * 6).toFixed(2)}%, 0, 0)` }} />
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {/* Editorial progress indicator */}
        <ol className="container-lux mt-12 grid max-w-xl grid-cols-4 gap-3" aria-label="Story progress">
          {stages.map((s, n) => {
            const fill = clamp(x - n + 1);
            return (
              <li key={s.k} aria-current={n === active ? "step" : undefined}>
                <button type="button" onClick={() => goTo(n)} className="w-full text-left text-[11px] uppercase tracking-[0.18em] transition-opacity" style={{ color: n === active ? fg : muted, opacity: n === active ? 1 : 0.6 }}>
                  <span className="relative block h-px w-full overflow-hidden" style={{ backgroundColor: mix(muted, "transparent", 0.6) }}>
                    <span className="absolute inset-0 origin-left" style={{ backgroundColor: fg, transform: `scaleX(${n === 0 ? 1 : fill})` }} />
                  </span>
                  <span className="mt-2 block">0{n + 1} {s.k}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Mobile: native swipeable cards; page scroll unaffected */}
      <div className="py-16 md:hidden">
        <p className="eyebrow container-lux">The beauty of being you</p>
        <p className="container-lux mt-2 text-xs" style={{ color: muted }}>Swipe to explore 4 rituals →</p>
        <div className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-5 pb-4 [scrollbar-width:none]" tabIndex={0} aria-label="Story cards">
          {stages.map((s, n) => (
            <article key={s.k} className="w-[82%] shrink-0 snap-center rounded-3xl p-4" style={{ backgroundColor: s.bg, color: s.fg }}>
              <img src={s.src} alt={s.alt} loading="lazy" decoding="async" className="aspect-[4/5] w-full rounded-2xl object-cover" />
              <p className="mt-4 font-serif text-sm italic" style={{ color: s.muted }}>0{n + 1} / 04 — {s.k}</p>
              <h2 className="mt-1 text-3xl leading-tight">{s.title}</h2>
              <p className="mt-2 text-[15px]" style={{ color: s.muted }}>{s.copy}</p>
              {s.cta && <Link to="/shop" className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">Explore the Collection <ArrowRight className="h-4 w-4" /></Link>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
