import { Link } from "@tanstack/react-router";
import { ArrowRight, Droplets, Eye, Feather, HandHeart, Leaf, Rabbit, ShieldCheck, Sparkles, Sun, Waves, Wind, FlaskConical, BadgeCheck } from "lucide-react";

import { RevealOnScroll, StaggerContainer, TextReveal } from "@/components/motion/Reveal";

const concerns = [
  { t: "Pigmentation", I: Sparkles, to: "/skincare" },
  { t: "Acne-Prone Skin", I: Droplets, to: "/skincare" },
  { t: "Dull / Dry Skin", I: Waves, to: "/skincare" },
  { t: "Dark Circles", I: Eye, to: "/skincare" },
  { t: "Sun Protection", I: Sun, to: "/skincare" },
  { t: "Hair Fall", I: Wind, to: "/haircare" },
  { t: "Dandruff", I: Feather, to: "/haircare" },
  { t: "Tan Removal", I: Leaf, to: "/skincare" },
] as const;

export function ShopByConcern() {
  return (
    <section className="container-lux py-20 md:py-28">
      <div className="text-center">
        <RevealOnScroll as="p" kind="fade" className="eyebrow">Shop by concern</RevealOnScroll>
        <TextReveal text="What does your skin need?" className="mt-3 text-4xl md:text-5xl" delay={80} />
      </div>
      <StaggerContainer step={60} className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-5">
        {concerns.map(({ t, I, to }) => (
          <Link key={t} to={to} className="group flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-4 py-8 text-center transition-all duration-500 hover:-translate-y-1 hover:border-primary hover:shadow-lg">
            <span className="grid size-14 place-items-center rounded-full bg-secondary text-primary transition-colors duration-500 group-hover:bg-primary group-hover:text-primary-foreground"><I className="size-6" strokeWidth={1.4} /></span>
            <span className="font-heading text-xl">{t}</span>
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground group-hover:text-primary">Shop <ArrowRight className="arrow-nudge size-3" /></span>
          </Link>
        ))}
      </StaggerContainer>
    </section>
  );
}

export function WhyChooseUs() {
  const items = [
    { I: Leaf, t: "Natural", d: "Built around plant-derived ingredients." },
    { I: HandHeart, t: "Gentle", d: "Made for everyday, comfortable use." },
    { I: BadgeCheck, t: "Honest", d: "Full ingredient lists, no hidden claims." },
    { I: ShieldCheck, t: "Effective", d: "Thoughtful formulas for real routines." },
    { I: FlaskConical, t: "Paraben free", d: "Formulated without parabens." },
    { I: Rabbit, t: "Cruelty free", d: "Never tested on animals." },
  ];
  return (
    <section className="bg-primary text-primary-foreground">
      <div className="container-lux py-20 md:py-24">
        <RevealOnScroll as="p" kind="fade" className="eyebrow !text-primary-foreground/60 text-center">What we stand for</RevealOnScroll>
        <TextReveal by="line" text={["Rooted in plants.", "Made with care."]} className="mx-auto mt-4 max-w-3xl text-center text-4xl leading-tight md:text-5xl" />
        <StaggerContainer step={80} kind="scale" className="mt-14 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-6">
          {items.map(({ I, t, d }) => (
            <div key={t} className="text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-full border border-primary-foreground/25"><I className="size-6 text-accent" strokeWidth={1.4} /></span>
              <h3 className="mt-4 text-2xl">{t}</h3>
              <p className="mx-auto mt-1 max-w-[12rem] text-xs opacity-70">{d}</p>
            </div>
          ))}
        </StaggerContainer>
        <p className="mt-10 text-center text-[11px] opacity-50">Claims shown are provisional and will be confirmed per product before launch.</p>
      </div>
    </section>
  );
}

export function FounderQuote() {
  return (
    <section className="container-lux py-20 md:py-28">
      <div className="mx-auto max-w-4xl text-center">
        <RevealOnScroll as="p" kind="fade" className="eyebrow">A note from our founder</RevealOnScroll>
        <RevealOnScroll as="blockquote" delay={120} className="mt-8 font-heading text-3xl italic leading-snug md:text-5xl">
          “I started Being You – Always for my own family — products I'd trust on the people I love. Today, that same care goes into every jar we make for you.”
        </RevealOnScroll>
        <RevealOnScroll delay={260} className="mt-8 flex items-center justify-center gap-4">
          <span className="h-px w-10 bg-accent" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em]">Founder, Being You – Always</span>
          <span className="h-px w-10 bg-accent" />
        </RevealOnScroll>
        <p className="mt-4 text-[11px] text-muted-foreground">Draft quote — founder's name and final words to be confirmed.</p>
      </div>
    </section>
  );
}

export const collections = [
  { name: "Skin Care", copy: "Serums, creams & cleansers", to: "/skincare" },
  { name: "Hair Care", copy: "Oils, shampoos & masks", to: "/haircare" },
  { name: "De-Tan Care", copy: "Brighten & even out", to: "/skincare" },
  { name: "Colour Cosmetics", copy: "Lips, cheeks & base", to: "/colour-cosmetics" },
  { name: "Combos", copy: "Complete rituals, better value", to: "/shop" },
] as const;
