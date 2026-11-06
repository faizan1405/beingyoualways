import { productImages } from "@/lib/product-images";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Droplets, Eye, Feather, HandHeart, Leaf, ShieldCheck, Sparkles, Sun, Waves, Wind, BadgeCheck } from "lucide-react";

import { concerns, type ConcernSlug } from "@/lib/concerns";
import { RevealOnScroll, StaggerContainer, TextReveal } from "@/components/motion/Reveal";

const icons: Record<ConcernSlug, typeof Sparkles> = {
  pigmentation: Sparkles, "acne-prone-skin": Droplets, "dull-dry-skin": Waves, "dark-circles": Eye,
  "sun-protection": Sun, "hair-fall": Wind, dandruff: Feather, "tan-removal": Leaf,
};

/** Real catalogue photos per concern — chosen to match each concern without implying results. */
const concernArt: Record<ConcernSlug, { src: string | undefined; pos: string; tone: string }> = {
  pigmentation: { src: productImages("face-serum")[1], pos: "50% 45%", tone: "oklch(0.3 0.05 45)" },
  "acne-prone-skin": { src: productImages("face-wash")[0], pos: "50% 50%", tone: "var(--primary)" },
  "dull-dry-skin": { src: productImages("aloe-vera-gel")[1], pos: "50% 50%", tone: "oklch(0.32 0.05 140)" },
  "dark-circles": { src: productImages("toner")[1], pos: "50% 40%", tone: "oklch(0.27 0.03 260)" },
  "sun-protection": { src: productImages("sunscreen")[0], pos: "50% 50%", tone: "oklch(0.38 0.08 60)" },
  "hair-fall": { src: productImages("hair-oil")[0], pos: "50% 50%", tone: "oklch(0.28 0.04 100)" },
  dandruff: { src: productImages("hair-mask")[0], pos: "50% 50%", tone: "oklch(0.3 0.03 180)" },
  "tan-removal": { src: productImages("volcanic-scrub")[0], pos: "50% 50%", tone: "oklch(0.34 0.07 30)" },
};

export function ShopByConcern() {
  return (
    <section className="container-lux py-20 md:py-28">
      <div className="text-center">
        <RevealOnScroll as="p" kind="fade" className="eyebrow">Shop by concern</RevealOnScroll>
        <TextReveal text="What does your skin need?" className="mt-3 text-4xl md:text-5xl" delay={80} />
      </div>
      <StaggerContainer step={60} className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
        {concerns.map(({ slug, name: t }) => { const I = icons[slug]; const a = concernArt[slug]; return (
          <Link key={slug} to="/concern/$slug" params={{ slug }} className="group relative isolate flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-2xl p-4 text-primary-foreground shadow-[var(--shadow-soft)] transition-[transform,box-shadow] duration-500 hover:-translate-y-1 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:aspect-[4/5] md:p-6">
            {a.src && <img src={a.src} alt="" loading="lazy" decoding="async" style={{ objectPosition: a.pos }} className="absolute inset-0 -z-10 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.07]" />}
            <div aria-hidden className="absolute inset-0 -z-10" style={{ background: `linear-gradient(to top, color-mix(in oklab, ${a.tone} 90%, transparent) 0%, color-mix(in oklab, ${a.tone} 45%, transparent) 42%, transparent 72%)` }} />
            <span className="absolute left-4 top-4 grid size-9 place-items-center rounded-full bg-background/85 text-primary backdrop-blur md:size-10"><I className="size-4" strokeWidth={1.5} /></span>
            <span className="font-serif text-xl leading-tight md:text-2xl">{t}</span>
            <span className="mt-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] opacity-90">Shop <ArrowRight className="arrow-nudge size-3" /></span>
          </Link>
        ); })}
      </StaggerContainer>
    </section>
  );
}

export function WhyChooseUs() {
  const items = [
    { I: Leaf, t: "Plant-based", d: "Nature-powered skin and hair care." },
    { I: HandHeart, t: "Gentle", d: "Care that's soft on you and the planet." },
    { I: BadgeCheck, t: "Honest", d: "Transparent ingredients with nothing to hide." },
    { I: ShieldCheck, t: "Effective", d: "Care you can trust, every day." },
  ];
  return (
    <section className="bg-primary text-primary-foreground">
      <div className="container-lux py-20 md:py-24">
        <RevealOnScroll as="p" kind="fade" className="eyebrow !text-primary-foreground/60 text-center">What we stand for</RevealOnScroll>
        <TextReveal by="line" text={["Rooted in plants.", "Made with care."]} className="mx-auto mt-4 max-w-3xl text-center text-4xl leading-tight md:text-5xl" />
        <StaggerContainer step={80} kind="scale" className="mt-14 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4 lg:grid-cols-4">
          {items.map(({ I, t, d }) => (
            <div key={t} className="text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-full border border-primary-foreground/25"><I className="size-6 text-accent" strokeWidth={1.4} /></span>
              <h3 className="mt-4 text-2xl">{t}</h3>
              <p className="mx-auto mt-1 max-w-[12rem] text-xs opacity-70">{d}</p>
            </div>
          ))}
        </StaggerContainer>
        <p className="mt-10 text-center text-[11px] opacity-50">Product-level claims (e.g. paraben-free, cruelty-free) will be shown only once confirmed for each product.</p>
      </div>
    </section>
  );
}

export function FounderQuote() {
  return (
    <section className="container-lux py-20 md:py-28">
      <div className="mx-auto max-w-4xl text-center">
        <RevealOnScroll as="p" kind="fade" className="eyebrow">A note from our founders</RevealOnScroll>
        <RevealOnScroll as="blockquote" delay={120} className="mt-8 font-serif text-3xl italic leading-snug md:text-[2.75rem]">
          “From our 9-year-old daughter to our 64-year-old mother, our family trusts many Being You Always products every day. That trust is our biggest responsibility. If we wouldn't choose it for our own family, we wouldn't create it for yours.”
        </RevealOnScroll>
        <RevealOnScroll delay={260} className="mt-8 flex items-center justify-center gap-4">
          <span className="h-px w-10 bg-accent" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em]">Priyanka & Anirudhh Rajput · Co-Founders, Being You Always</span>
          <span className="h-px w-10 bg-accent" />
        </RevealOnScroll>
      </div>
    </section>
  );
}

/** Real catalogue photos (beingyoualways.com) per collection — each card gets its own crop and tone. */
export const collections = [
  { name: "Skin Care", copy: "Serums, creams & cleansers", to: "/skincare", images: [productImages("face-serum")[0]], pos: "50% 40%", tone: "var(--primary)" },
  { name: "Hair Care", copy: "Oils, shampoos & masks", to: "/haircare", images: [productImages("shampoo")[0]], pos: "60% 50%", tone: "oklch(0.32 0.04 140)" },
  { name: "De-Tan Care", copy: "Brighten & even out", to: "/de-tan-care", images: [productImages("tomato-face-wash")[0]], pos: "30% 50%", tone: "oklch(0.36 0.07 35)" },
  { name: "Colour Cosmetics", copy: "Lips, cheeks & base", to: "/colour-cosmetics", images: [productImages("liquid-matte-lipstick")[3]], pos: "50% 0%", zoom: true, tone: "oklch(0.25 0.03 20)" },
  { name: "Combos", copy: "Complete rituals, better value", to: "/combos", images: [productImages("aloe-vera-gel")[0], productImages("herbal-wax-powder")[1]], pos: "50% 50%", tone: "var(--primary)" },
] as const;
