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
  moments: [Moment, Moment, Moment];
  fromBg: string;
  toBg: string;
  products: Product[];
  ctaLabel: string;
  ctaTo: "/skincare" | "/haircare" | "/shop";
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => t * t * (3 - 2 * t);

/** Transformation 0–1 while the visual passes through the viewport (normal flow). Exported for tests. */
export function concernProgress(top: number, height: number, vh: number) {
  const raw = (vh * 0.7 - top) / Math.max(1, height * 0.75);
  return ease(clamp(raw));
}
/** Before (0) → The Journey (1) → After (2). */
export const momentAt = (t: number) => (t < 0.33 ? 0 : t < 0.72 ? 1 : 2);

export const DISCLOSURE = "AI-generated illustrative imagery — not actual customer or product results.";

export function ConcernStory(p: ConcernStoryProps) {
  const ref = useRef<HTMLElement>(null);
  const [t, setT] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setStill(true); return; }
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { const r = el.getBoundingClientRect(); setT(concernProgress(r.top, r.height, window.innerHeight)); });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, []);

  const m = still ? 2 : momentAt(t);
  const bg = `color-mix(in oklab, ${p.fromBg} ${((1 - t) * 100).toFixed(1)}%, ${p.toBg})`;

  return (
    <section ref={ref} id={p.id} aria-labelledby={`${p.id}-h`} className="relative scroll-mt-20" style={{ backgroundColor: still ? p.toBg : bg }} data-moment={m}>
      <div className="container-lux grid items-center gap-10 py-20 md:grid-cols-[1.05fr_1fr] md:gap-16 md:py-28">
        <figure className="relative mx-auto w-full max-w-[520px]">
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
          <figcaption className="mt-3 text-center text-[11px] leading-snug text-muted-foreground">{DISCLOSURE}</figcaption>
        </figure>

        <div>
          <p className="eyebrow">0{p.index} — {p.name}</p>
          <ol className="mt-5 flex gap-4 text-[11px] uppercase tracking-[0.18em]" aria-label="Story moments">
            {p.moments.map((x, n) => (
              <li key={x.label} aria-current={n === m ? "step" : undefined} className="transition-opacity duration-500" style={{ opacity: n === m ? 1 : 0.45 }}>
                <span className="mb-2 block h-px w-10 bg-current" />{x.label}
              </li>
            ))}
          </ol>
          <div className="relative mt-6 grid">
            {p.moments.map((x, n) => (
              <div key={x.label} aria-hidden={n !== m} className="story-text col-start-1 row-start-1" data-on={n === m || undefined}>
                <h2 id={n === 0 ? `${p.id}-h` : undefined} className="story-line text-4xl leading-[1.08] md:text-5xl">{x.title}</h2>
                <p className="story-line mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">{x.copy}</p>
              </div>
            ))}
          </div>
          <Link to={p.ctaTo} className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-[transform,opacity] duration-500 hover:-translate-y-0.5" style={{ opacity: m === 2 ? 1 : 0.85 }}>
            {p.ctaLabel} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {p.products.length > 0 && (
        <div className="container-lux pb-20 md:pb-28">
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
