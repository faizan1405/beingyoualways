import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { ProductCard } from "@/components/shop/ProductCard";
import type { Product } from "@/lib/types";

export type Moment = { label: string; title: string; copy: string };

export interface ConcernStoryProps {
  id: string;
  index: number;
  name: string;
  before: string;
  after: string;
  beforeAlt: string;
  afterAlt: string;
  pos?: string;
  moments: [Moment, Moment, Moment, Moment];
  fromBg: string;
  toBg: string;
  products: Product[];
  ctaLabel: string;
  ctaTo: "/skincare" | "/haircare" | "/shop";
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => t * t * (3 - 2 * t);

/** Chapter progress 0–1 through its own bounded sticky range. Exported for tests. */
export function chapterProgress(top: number, height: number, vh: number) {
  return clamp(-top / Math.max(1, height - vh));
}
/** Before held to 20%, changes through 20–80%, After held from 80% to the end. */
export const transformAt = (p: number) => ease(clamp((p - 0.2) / 0.6));
/** Four editorial moments: 0–20 / 20–50 / 50–75 / 75–100%. */
export const momentAt = (p: number) => (p < 0.2 ? 0 : p < 0.5 ? 1 : p < 0.75 ? 2 : 3);
/** The chapter CTA appears once the After visual has settled (last ~12%). */
export const ctaAt = (p: number) => p >= 0.88;

export function ConcernStory(p: ConcernStoryProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [p0, setP] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setStill(true); return; }
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { const r = el.getBoundingClientRect(); const inner = el.firstElementChild as HTMLElement | null; const off = inner ? parseFloat(getComputedStyle(inner).top) || 0 : 0; setP(chapterProgress(r.top - off, r.height, (inner?.offsetHeight ?? window.innerHeight))); });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, []);

  const t = still ? 1 : transformAt(p0);
  const m = still ? 3 : momentAt(p0);
  const cta = still || ctaAt(p0);
  const bg = `color-mix(in oklab, ${p.fromBg} ${((1 - t) * 100).toFixed(1)}%, ${p.toBg})`;

  return (
    <section id={p.id} aria-labelledby={`${p.id}-h`} className="relative scroll-mt-16" style={{ backgroundColor: still ? p.toBg : bg }} data-moment={m}>
      <div ref={ref} className={still ? "" : "h-[230svh] md:h-[260vh]"}>
      <div className={`${still ? "py-16" : "sticky top-14 h-[calc(100svh-3.5rem)] md:top-16 md:h-[calc(100vh-4rem)]"} flex items-center`}>
      <div className="container-lux grid w-full items-center gap-5 md:grid-cols-[1.05fr_1fr] md:gap-16">
        <figure className="relative mx-auto w-full max-w-[min(100%,36svh)] md:max-w-[min(480px,62vh)]">
          {still ? (
            <div className="grid grid-cols-2 gap-3">
              {[{ s: p.before, a: p.beforeAlt, l: "Before" }, { s: p.after, a: p.afterAlt, l: "After" }].map((x) => (
                <div key={x.l}>
                  <img src={x.s} alt={x.a} loading="lazy" width={1024} height={1280} className="aspect-[4/5] w-full rounded-2xl object-cover" style={{ objectPosition: p.pos }} />
                  <p className="mt-2 text-center text-[11px] uppercase tracking-[0.18em]">{x.l}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[2rem] bg-secondary shadow-[var(--shadow-soft)]">
              <img src={p.before} alt={p.beforeAlt} loading="lazy" width={1024} height={1280} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: p.pos, transform: `scale(${(1.06 - t * 0.04).toFixed(3)})` }} />
              <img src={p.after} alt={t > 0.5 ? p.afterAlt : ""} aria-hidden={t <= 0.5} loading="lazy" width={1024} height={1280} className="absolute inset-0 h-full w-full object-cover will-change-[opacity]" style={{ objectPosition: p.pos, opacity: t, transform: `scale(${(1.06 - t * 0.04).toFixed(3)})` }} />
              <div className="absolute inset-x-4 top-4 flex items-center gap-3 rounded-full bg-background/85 px-4 py-2 text-foreground backdrop-blur" aria-hidden>
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Before</span>
                <span className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-border"><span className="absolute inset-0 origin-left bg-primary" style={{ transform: `scaleX(${t.toFixed(3)})` }} /></span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">After</span>
              </div>
            </div>
          )}
        </figure>

        <div>
          <p className="eyebrow">0{p.index} — {p.name}</p>
          <ol className="mt-4 flex flex-wrap gap-x-3 gap-y-2 text-[10px] md:mt-5 md:gap-4 md:text-[11px] uppercase tracking-[0.18em]" aria-label="Story moments">
            {p.moments.map((x, n) => (
              <li key={x.label} aria-current={n === m ? "step" : undefined} className="transition-opacity duration-500" style={{ opacity: n === m ? 1 : 0.45 }}>
                <span className="mb-2 block h-px w-10 bg-current" />{x.label}
              </li>
            ))}
          </ol>
          <div className="relative mt-4 grid md:mt-6">
            {p.moments.map((x, n) => (
              <div key={x.label} aria-hidden={n !== m} className="story-text col-start-1 row-start-1" data-on={n === m || undefined}>
                <h2 id={n === 0 ? `${p.id}-h` : undefined} className="story-line text-3xl leading-[1.08] md:text-5xl">{x.title}</h2>
                <p className="story-line mt-3 max-w-md text-sm md:mt-4 md:text-[15px] leading-relaxed text-muted-foreground">{x.copy}</p>
              </div>
            ))}
          </div>
          <Link to={p.ctaTo} tabIndex={cta ? 0 : -1} aria-hidden={!cta} className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium btn-motion transition-[opacity,transform] duration-500 text-primary-foreground hover:bg-[color-mix(in_oklab,var(--primary)_86%,var(--foreground))] md:mt-8"
            style={{ opacity: cta ? 1 : 0, transform: cta ? "none" : "translateY(10px)", pointerEvents: cta ? "auto" : "none" }}>
            {p.ctaLabel} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      </div>
      </div>

      {p.products.length > 0 && (
        <div className="container-lux pb-20 pt-4 md:pb-28">
          <p className="eyebrow">Products to explore</p>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">Chosen from our catalogue because their own descriptions mention this area of care. Individual results vary.</p>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {p.products.slice(0, 4).map((pr, n) => <ProductCard key={pr.id} product={pr} index={n} />)}
          </div>
        </div>
      )}
    </section>
  );
}
