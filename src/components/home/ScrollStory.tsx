import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { productImages } from "@/lib/product-images";

type Stage = { k: string; title: string; copy: string; src?: string; alt: string; bg: string; fg: string; muted: string; cta?: boolean };

export const stages: Stage[] = [
  { k: "Discover", title: "Discover the beauty of nature.", copy: "Thoughtful beauty begins with inspiration from the natural world.", src: productImages("toner")[0], alt: "Being You toner among fresh fennel flowers", bg: "var(--background)", fg: "var(--foreground)", muted: "var(--muted-foreground)" },
  { k: "Care", title: "Make every moment a ritual.", copy: "Discover skincare designed to make everyday care feel personal.", src: productImages("face-serum")[0], alt: "Being You face serum", bg: "color-mix(in oklab, var(--sage) 70%, var(--background))", fg: "var(--sage-foreground)", muted: "color-mix(in oklab, var(--sage-foreground) 75%, transparent)" },
  { k: "Nourish", title: "Care that goes beyond the surface.", copy: "Make room for thoughtful haircare in your everyday routine.", src: productImages("hair-oil")[0], alt: "Being You hair oil", bg: "var(--primary)", fg: "var(--primary-foreground)", muted: "color-mix(in oklab, var(--primary-foreground) 75%, transparent)" },
  { k: "Express", title: "Express the beauty of being you.", copy: "Explore colour, creativity and the confidence to embrace your individuality.", src: productImages("liquid-matte-lipstick")[1], alt: "Being You liquid matte lipstick", bg: "color-mix(in oklab, var(--accent) 55%, var(--background))", fg: "var(--foreground)", muted: "color-mix(in oklab, var(--foreground) 75%, transparent)", cta: true },
];

const mix = (a: string, b: string, t: number) => `color-mix(in oklab, ${a} ${((1 - t) * 100).toFixed(1)}%, ${b})`;
const ease = (t: number) => t * t * (3 - 2 * t);

/** Map 0–1 section progress to stage index + blend toward the next stage. Exported for tests. */
export function stageAt(p: number, n = stages.length) {
  const x = Math.min(n - 1, Math.max(0, p * (n - 1)));
  const i = Math.floor(x);
  // hold each stage, blend only in the middle 50% between stages
  const local = x - i;
  const blend = ease(Math.min(1, Math.max(0, (local - 0.25) / 0.5)));
  return { i, blend, active: Math.min(n - 1, Math.round(i + blend)) };
}

/** "The Beauty of Being You" — four-stage story. Plain page scroll drives it; no wheel interception or scroll locking. */
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
        const total = r.height - window.innerHeight;
        setP(total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0);
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, []);

  const { i, blend, active } = stageAt(p);
  const a = stages[i]!, b = stages[Math.min(stages.length - 1, i + 1)]!;
  const bg = mix(a.bg, b.bg, blend), fg = mix(a.fg, b.fg, blend), muted = mix(a.muted, b.muted, blend);

  return (
    <section ref={ref} aria-label="The beauty of being you" className="story relative md:h-[300vh]">
      {/* Desktop/tablet: sticky panel inside normal flow */}
      <div className="sticky top-0 hidden h-screen overflow-hidden md:block" style={{ backgroundColor: bg, color: fg }} data-stage={stages[active]!.k}>
        <span aria-hidden className="story-orb absolute -left-24 top-1/4 h-72 w-72 rounded-full" style={{ transform: `translate3d(0, ${(-p * 120).toFixed(1)}px, 0)` }} />
        <span aria-hidden className="story-orb absolute -right-16 bottom-10 h-56 w-56 rounded-full" style={{ transform: `translate3d(0, ${(p * 90).toFixed(1)}px, 0)` }} />
        <div className="container-lux relative grid h-full items-center gap-14 md:grid-cols-[1fr_1.05fr]">
          <div className="relative">
            <p className="eyebrow" style={{ color: muted }}>The beauty of being you</p>
            <div className="relative mt-6 min-h-[19rem]">
              {stages.map((s, n) => (
                <div key={s.k} aria-hidden={n !== active} className="story-text absolute inset-0" data-on={n === active || undefined}>
                  <p className="story-line font-serif text-xl italic" style={{ color: muted }}>0{n + 1} — {s.k}</p>
                  <h2 className="story-line mt-3 text-5xl leading-[1.05] lg:text-6xl" style={{ color: fg }}>{s.title}</h2>
                  <p className="story-line mt-5 max-w-md text-[15px] leading-relaxed" style={{ color: muted }}>{s.copy}</p>
                  {s.cta && (
                    <Link to="/shop" tabIndex={n === active ? 0 : -1} className="story-line mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5">
                      Explore the Collection <ArrowRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
            {/* Editorial progress indicator */}
            <ol className="mt-8 grid max-w-md grid-cols-4 gap-3" aria-label="Story progress">
              {stages.map((s, n) => {
                const fill = Math.min(1, Math.max(0, p * (stages.length - 1) - n + 1));
                return (
                  <li key={s.k} aria-current={n === active ? "step" : undefined} className="text-[11px] uppercase tracking-[0.18em]" style={{ color: n === active ? fg : muted, opacity: n === active ? 1 : 0.6 }}>
                    <span className="relative block h-px w-full overflow-hidden" style={{ backgroundColor: mix(muted, "transparent", 0.6) }}>
                      <span className="absolute inset-y-0 left-0 w-full origin-left" style={{ backgroundColor: fg, transform: `scaleX(${n === 0 ? 1 : fill})` }} />
                    </span>
                    <span className="mt-2 block">0{n + 1} {s.k}</span>
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-[2rem] shadow-[var(--shadow-soft)]">
            {stages.map((s, n) => {
              const d = p * (stages.length - 1) - n;
              return (
                <img key={s.k} src={s.src} alt={n === active ? s.alt : ""} loading="lazy" decoding="async" data-on={n === active || undefined}
                  className="story-img absolute inset-0 h-full w-full object-cover"
                  style={{ transform: `scale(${(1.06 - d * 0.04).toFixed(3)}) translate3d(0, ${(d * -14).toFixed(1)}px, 0)` }} />
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile: stacked stages, each with its own colour */}
      <div className="md:hidden">
        <p className="eyebrow container-lux pt-16 text-center">The beauty of being you</p>
        {stages.map((s, n) => (
          <article key={s.k} className="py-12" style={{ backgroundColor: s.bg, color: s.fg }}>
            <div className="container-lux">
              <p className="font-serif text-sm italic" style={{ color: s.muted }}>0{n + 1} / 04 — {s.k}</p>
              <img src={s.src} alt={s.alt} loading="lazy" decoding="async" className="mt-4 aspect-[4/5] w-full rounded-3xl object-cover" />
              <h2 className="mt-5 text-4xl leading-tight">{s.title}</h2>
              <p className="mt-3 text-[15px]" style={{ color: s.muted }}>{s.copy}</p>
              {s.cta && <Link to="/shop" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground">Explore the Collection <ArrowRight className="h-4 w-4" /></Link>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
