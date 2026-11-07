import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import before from "@/assets/concerns/pig-before.jpg";
import after from "@/assets/concerns/pig-after.jpg";
import { DISCLOSURE } from "@/components/concerns/ConcernStory";
import { Button } from "@/components/ui/button";

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/** Progress 0–1 through the hero's bounded sticky range. */
export function heroProgress(top: number, height: number, vh: number) {
  return clamp(-top / Math.max(1, height - vh));
}

/** Face transformation from hero progress: hold Before to 10%, fade until 80%, then hold the clear face. */
export function transformAmount(p: number) {
  const t = clamp((p - 0.1) / 0.7);
  return t * t * (3 - 2 * t);
}

/**
 * Campaign hero with a short bounded sticky scene (~1.7 viewports total on desktop, shorter on mobile).
 * Page scroll drives the crossfade; the clear face is fully shown and held before the hero releases.
 * No wheel interception, no comparison bar, no autoplay. Reduced motion → static clear portrait.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const [amount, setAmount] = useState(0);
  const [started, setStarted] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setStill(true); return; }
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect(); const inner = el.firstElementChild as HTMLElement | null; const off = inner ? parseFloat(getComputedStyle(inner).top) || 0 : 0;
        const p = heroProgress(r.top - off, r.height, (inner?.offsetHeight ?? window.innerHeight));
        setAmount(transformAmount(p));
        setStarted(p > 0.02);
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, []);

  return (
    <section ref={ref} className={`bg-hero relative ${still ? "" : "h-[150svh] md:h-[170vh]"}`} aria-label="Introduction">
      <div className={`${still ? "" : "sticky top-14 md:top-16"} flex h-[calc(100svh-3.5rem)] items-center md:h-[calc(100vh-4rem)]`}>
        <div className="container-lux grid w-full items-center gap-5 md:grid-cols-[1fr_1.05fr] md:gap-12">
          <div className="order-2 text-center md:order-1 md:text-left">
            <p className="eyebrow hero-in" style={{ animationDelay: "100ms" }}>Plant-based beauty · Made in India</p>
            <h1 className="mt-3 text-[2.2rem] leading-[0.98] sm:text-6xl md:mt-5 lg:text-[5.4rem]" aria-label="Beauty that feels like you, always.">
              {["Beauty", "that", "feels", "|", "like you,", "always."].map((w, i) =>
                w === "|" ? <br key={i} /> : (
                  <span key={i} aria-hidden className="text-mask mr-[0.22em]">
                    <span className={`hero-word ${w === "like you," ? "italic text-accent" : ""}`} style={{ animationDelay: `${220 + i * 85}ms` }}>{w}</span>
                  </span>
                ),
              )}
            </h1>
            <p className="hero-in mx-auto mt-3 hidden max-w-md text-[15px] leading-relaxed text-muted-foreground sm:block md:mx-0 md:mt-6" style={{ animationDelay: "800ms" }}>
              Nature-inspired beauty rituals for uneven skin tone, dark spots and everyday radiance.
            </p>
            <div className="hero-in mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 md:mt-9 md:justify-start" style={{ animationDelay: "950ms" }}>
              <Button variant="lux" size="xl" className="group" asChild><Link to="/shop">Shop Collection <ArrowRight className="arrow-nudge" /></Link></Button>
              <Button variant="outline" size="xl" asChild className="rounded-full border-primary/40 bg-transparent"><Link to="/explore-concerns">Explore by Concern</Link></Button>
              <Button variant="link" asChild className="group uppercase tracking-[0.14em] text-xs"><Link to="/about">Our story <ArrowRight className="arrow-nudge" /></Link></Button>
            </div>
          </div>

          <figure className="hero-in order-1 mx-auto w-full max-w-[min(100%,340px)] sm:max-w-[400px] md:order-2 md:max-w-none" style={{ animationDelay: "300ms" }}>
            <div className="relative mx-auto aspect-[4/5] max-h-[52svh] overflow-hidden rounded-t-[999px] rounded-b-[2rem] bg-secondary shadow-[var(--shadow-soft)] md:max-h-[min(78vh,720px)]">
              {still ? (
                <img src={after} alt="Illustrative portrait: woman with a more even-looking complexion" width={1024} height={1280} fetchPriority="high" className="absolute inset-0 h-full w-full object-cover object-[50%_30%]" />
              ) : (
                <>
                  <img src={before} alt="Illustrative portrait: woman with visible pigmentation, dark spots and uneven skin tone" width={1024} height={1280} fetchPriority="high"
                    className="absolute inset-0 h-full w-full object-cover object-[50%_30%]" style={{ transform: `scale(${(1.06 - amount * 0.04).toFixed(3)})` }} />
                  <img src={after} alt={amount > 0.5 ? "The same woman with lighter-looking dark spots and a more even tone" : ""} aria-hidden={amount <= 0.5} width={1024} height={1280}
                    className="absolute inset-0 h-full w-full object-cover object-[50%_30%] will-change-[opacity]"
                    style={{ opacity: amount, transform: `scale(${(1.06 - amount * 0.04).toFixed(3)})` }} />
                  <p aria-hidden className="absolute inset-x-0 bottom-6 text-center text-[11px] font-medium uppercase tracking-[0.22em] text-background transition-opacity duration-500" style={{ opacity: started ? 0 : 0.95 }}>
                    Scroll to reveal ↓
                  </p>
                </>
              )}
            </div>
            <figcaption className="mt-2 text-center text-[11px] text-muted-foreground">{DISCLOSURE}</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
