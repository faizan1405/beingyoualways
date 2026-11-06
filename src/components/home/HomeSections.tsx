import { Link } from "@tanstack/react-router";
import { ArrowRight, Droplets, Eye, Feather, HandHeart, Leaf, ShieldCheck, Sparkles, Sun, Waves, Wind, BadgeCheck } from "lucide-react";

import { concerns, type ConcernSlug } from "@/lib/concerns";
import { RevealOnScroll, StaggerContainer, TextReveal } from "@/components/motion/Reveal";

const icons: Record<ConcernSlug, typeof Sparkles> = {
  pigmentation: Sparkles, "acne-prone-skin": Droplets, "dull-dry-skin": Waves, "dark-circles": Eye,
  "sun-protection": Sun, "hair-fall": Wind, dandruff: Feather, "tan-removal": Leaf,
};

export function ShopByConcern() {
  return (
    <section className="container-lux py-20 md:py-28">
      <div className="text-center">
        <RevealOnScroll as="p" kind="fade" className="eyebrow">Shop by concern</RevealOnScroll>
        <TextReveal text="What does your skin need?" className="mt-3 text-4xl md:text-5xl" delay={80} />
      </div>
      <StaggerContainer step={60} className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-5">
        {concerns.map(({ slug, name: t }) => { const I = icons[slug]; return (
          <Link key={slug} to="/concern/$slug" params={{ slug }} className="group flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-4 py-8 text-center transition-all duration-500 hover:-translate-y-1 hover:border-primary hover:shadow-lg">
            <span className="grid size-14 place-items-center rounded-full bg-secondary text-primary transition-colors duration-500 group-hover:bg-primary group-hover:text-primary-foreground"><I className="size-6" strokeWidth={1.4} /></span>
            <span className="font-serif text-xl">{t}</span>
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground group-hover:text-primary">Shop <ArrowRight className="arrow-nudge size-3" /></span>
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

export const collections = [
  { name: "Skin Care", copy: "Serums, creams & cleansers", to: "/skincare" },
  { name: "Hair Care", copy: "Oils, shampoos & masks", to: "/haircare" },
  { name: "De-Tan Care", copy: "Brighten & even out", to: "/de-tan-care" },
  { name: "Colour Cosmetics", copy: "Lips, cheeks & base", to: "/colour-cosmetics" },
  { name: "Combos", copy: "Complete rituals, better value", to: "/combos" },
] as const;
