import { useEffect, useRef, useState } from "react";

import { productImages } from "@/lib/product-images";

const scenes = [
  { k: "Discover", title: "Beauty that begins in nature.", copy: "Plants, flowers and botanicals inspire every formula we make.", src: productImages("toner")[0], alt: "Being You toner among fresh fennel flowers", tone: "var(--secondary)" },
  { k: "Care", title: "Gentle rituals, every day.", copy: "Honest skin and hair care our founders trust for their own family.", src: productImages("face-serum")[0], alt: "Being You face serum", tone: "color-mix(in oklab, var(--accent) 18%, var(--background))" },
  { k: "Express", title: "Colour that's confidently you.", copy: "Lips, eyes and base made for self-expression — your way, always.", src: productImages("liquid-matte-lipstick")[1], alt: "Being You liquid matte lipstick", tone: "color-mix(in oklab, var(--primary) 12%, var(--background))" },
];

/** "The Beauty of Being You" — sticky, scroll-linked three-scene story. No scroll hijacking: plain page scroll drives it. */
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

  const active = Math.min(scenes.length - 1, Math.floor(p * scenes.length));

  return (
    <section ref={ref} aria-label="The beauty of being you" className="story relative md:h-[260vh]">
      {/* Desktop: sticky scene */}
      <div className="sticky top-0 hidden h-screen overflow-hidden transition-[background-color] duration-700 md:block" style={{ backgroundColor: scenes[active]?.tone }}>
        <div className="container-lux grid h-full items-center gap-14 md:grid-cols-[1fr_1.05fr]">
          <div className="relative">
            <p className="eyebrow">The beauty of being you</p>
            <div className="relative mt-6 min-h-[17rem]">
              {scenes.map((s, i) => (
                <div key={s.k} aria-hidden={i !== active} className="story-text absolute inset-0" data-on={i === active || undefined}>
                  <p className="font-serif text-xl italic text-accent">0{i + 1} — {s.k}</p>
                  <h2 className="mt-3 text-5xl leading-[1.05] lg:text-6xl">{s.title}</h2>
                  <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">{s.copy}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-2" aria-hidden>
              {scenes.map((s, i) => <span key={s.k} className={`h-0.5 rounded-full transition-all duration-500 ${i === active ? "w-12 bg-primary" : "w-6 bg-border"}`} />)}
            </div>
          </div>
          <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-[2rem] shadow-[var(--shadow-soft)]">
            {scenes.map((s, i) => (
              <img key={s.k} src={s.src} alt={i === active ? s.alt : ""} loading="lazy" decoding="async" data-on={i === active || undefined}
                className="story-img absolute inset-0 h-full w-full object-cover"
                style={{ transform: `scale(${1.08 - (p * scenes.length - i) * 0.03})` }} />
            ))}
          </div>
        </div>
      </div>

      {/* Mobile: simple stacked scenes */}
      <div className="container-lux space-y-14 py-20 md:hidden">
        <p className="eyebrow text-center">The beauty of being you</p>
        {scenes.map((s, i) => (
          <article key={s.k}>
            <img src={s.src} alt={s.alt} loading="lazy" decoding="async" className="aspect-[4/5] w-full rounded-3xl object-cover" />
            <p className="mt-5 font-serif text-lg italic text-accent">0{i + 1} — {s.k}</p>
            <h2 className="mt-2 text-4xl leading-tight">{s.title}</h2>
            <p className="mt-3 text-[15px] text-muted-foreground">{s.copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
