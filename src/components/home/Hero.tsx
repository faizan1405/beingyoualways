import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import before from "@/assets/hero-acne-before.jpg";
import after from "@/assets/hero-pig-after.jpg";
import { Button } from "@/components/ui/button";

/** Fraction of the viewport height scrolled at which the After photo is fully shown. */
export const COMPLETE_AT = 0.55;

/** Map page scroll (px) to the transformation 0–1: complete after ~55% of one viewport, eased. */
export function transformAmount(scrollY: number, viewportHeight: number) {
  const t = Math.min(1, Math.max(0, scrollY / (viewportHeight * COMPLETE_AT)));
  return t * t * (3 - 2 * t);
}

/**
 * Hero with a scroll-linked skin transformation. The hero stays in normal document flow (no
 * pinning, no extra height); ordinary page scroll drives the crossfade between two aligned
 * photos of the same woman. No autoplay, no slider, no scroll locking. Reduced motion → static.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const [amount, setAmount] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setStill(true); return; }
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setAmount(transformAmount(window.scrollY, window.innerHeight)));
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, []);

  const pct = Math.round(amount * 100);

  return (
    <section ref={ref} className="bg-hero relative" aria-label="Introduction">
      <div className="flex min-h-[calc(100svh-3.5rem)] items-center overflow-hidden md:min-h-[calc(100vh-4rem)]`}>
        <div className="container-lux grid w-full items-center gap-6 py-6 md:grid-cols-2 md:gap-10 md:py-8">
          <div className="order-2 text-center md:order-1 md:text-left">
            <p className="eyebrow hero-in" style={{ animationDelay: "100ms" }}>Plant-based beauty · Made in India</p>
            <h1 className="mt-4 text-[2.4rem] leading-[0.98] sm:text-6xl md:mt-5 lg:text-[5.2rem]" aria-label="Beauty that feels like you, always.">
              {["Beauty", "that", "feels", "|", "like you,", "always."].map((w, i) =>
                w === "|" ? <br key={i} /> : (
                  <span key={i} aria-hidden className="text-mask mr-[0.22em]">
                    <span className={`hero-word ${w === "like you," ? "italic text-accent" : ""}`} style={{ animationDelay: `${220 + i * 85}ms` }}>{w}</span>
                  </span>
                ),
              )}
            </h1>
            <p className="hero-in mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground md:mx-0 md:mt-6" style={{ animationDelay: "800ms" }}>
              Plant-powered care for pigmentation, dullness and uneven tone — for a healthier-looking glow, naturally.
            </p>
            <div className="hero-in mt-6 flex flex-col items-center gap-2 sm:flex-row md:mt-9 md:justify-start md:gap-3" style={{ animationDelay: "950ms" }}>
              <Button variant="lux" size="xl" className="group" asChild><Link to="/shop">Shop Collection <ArrowRight className="arrow-nudge" /></Link></Button>
              <Button variant="link" asChild className="group uppercase tracking-[0.14em] text-xs"><Link to="/about">Our story <ArrowRight className="arrow-nudge" /></Link></Button>
            </div>
          </div>

          <figure className="hero-in order-1 mx-auto w-full max-w-[min(100%,300px)] sm:max-w-[380px] md:order-2 md:max-w-[520px]" style={{ animationDelay: "300ms" }}>
            <div className="relative aspect-[4/5] max-h-[46svh] w-full overflow-hidden rounded-[1.75rem] bg-secondary shadow-[var(--shadow-soft)] md:max-h-[min(76vh,680px)]" style={{ marginInline: "auto" }}>
              <img src={before} alt="Illustrative portrait: woman with visible acne and red spots on her cheeks, forehead and chin" width={1024} height={1280} fetchPriority="high" className="absolute inset-0 h-full w-full object-cover object-[50%_30%]" />
              <img src={after} alt={still ? "" : "The same woman with clearer-looking skin and fewer visible pimples"} aria-hidden={still || amount < 0.5} width={1024} height={1280}
                className="absolute inset-0 h-full w-full object-cover object-[50%_30%] will-change-[opacity]"
                style={{ opacity: still ? 0 : amount }} />
              {!still && (
                <div className="absolute inset-x-4 top-4 flex items-center gap-3 rounded-full bg-background/80 px-4 py-2 backdrop-blur" aria-hidden>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Before</span>
                  <span className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-border"><span className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${pct}%` }} /></span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">After</span>
                </div>
              )}
              {!still && amount < 0.05 && <p className="absolute inset-x-0 bottom-10 text-center text-[11px] font-medium tracking-[0.12em] text-background/95 transition-opacity">Scroll to see the change ↓</p>}
            </div>
            {still && (
              <img src={after} alt="The same woman with clearer-looking skin and fewer visible pimples" width={1024} height={1280} loading="lazy" className="mt-3 aspect-[4/5] max-h-[46svh] w-full rounded-[1.75rem] object-cover object-[50%_30%]" />
            )}
            <figcaption className="mt-3 text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Illustrative imagery — not actual product results</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
