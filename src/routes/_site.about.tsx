import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, Compass, HandHeart, Leaf, ShieldCheck, Sparkles } from "lucide-react";

import { ProductVisual } from "@/components/shop/ProductVisual";
import { Button } from "@/components/ui/button";
import { ImageReveal, Parallax, RevealOnScroll, StaggerContainer, TextReveal } from "@/components/motion/Reveal";
import { aboutContent, founderContent } from "@/config/business";
import { productImages } from "@/lib/product-images";

export const Route = createFileRoute("/_site/about")({
  head: () => ({
    meta: [
      { title: "About Us | Being You – Always" },
      { name: "description", content: "Beauty begins with being you. Nature-inspired skincare, haircare and colour cosmetics from Being You – Always, co-founded by Priyanka & Anirudhh Rajput." },
      { property: "og:title", content: "About Us | Being You – Always" },
      { property: "og:description", content: "Beauty begins with being you — nature-inspired care for confident, authentic beauty." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: About,
});

const values = [
  { I: HandHeart, t: "Gentle", d: "Care that feels soft and comfortable in everyday routines." },
  { I: BadgeCheck, t: "Honest", d: "Clear about what goes into our products and what they're for." },
  { I: ShieldCheck, t: "Effective", d: "Thoughtful formulas made to be used and enjoyed every day." },
  { I: Leaf, t: "Nature-inspired", d: "Rituals rooted in plant-based, nature-inspired care." },
  { I: Sparkles, t: "Confidence", d: "Feeling comfortable and beautiful in your own skin." },
  { I: Compass, t: "Self-expression", d: "Beauty that celebrates who you already are." },
];

function About() {
  const [lead, ...rest] = aboutContent.story;
  return (
    <>
      <section className="bg-page py-24 text-center md:py-32">
        <div className="container-lux max-w-4xl">
          <p className="eyebrow hero-in">Our story</p>
          <TextReveal as="h1" by="line" text={["Beauty begins", <><em>with being you.</em></>]} className="mt-4 text-5xl leading-[1.05] md:text-8xl" delay={120} />
          <p className="hero-in mx-auto mt-8 max-w-xl font-serif text-xl italic text-muted-foreground md:text-2xl" style={{ animationDelay: "500ms" }}>{lead}</p>
        </div>
      </section>

      <section className="container-lux grid items-center gap-12 py-20 md:grid-cols-2 md:py-28">
        <Parallax speed={-0.05}><ImageReveal className="rounded-xl"><ProductVisual src={productImages("aloe-vera-gel")[1]} shape="jar" tint="oklch(0.82 0.08 70)" label="Being You ritual" variant={2} /></ImageReveal></Parallax>
        <RevealOnScroll kind="slide-right" delay={150} className="space-y-5 text-[16px] leading-relaxed text-muted-foreground">
          <p className="eyebrow">Naturally you</p>
          <h2 className="text-4xl leading-tight text-foreground md:text-5xl">More than a routine.</h2>
          {rest.map((p) => <p key={p}>{p}</p>)}
          <p className="font-serif text-2xl italic text-foreground">{aboutContent.signoff}</p>
        </RevealOnScroll>
      </section>

      <section className="border-y border-border bg-page">
        <div className="container-lux grid gap-0 md:grid-cols-2">
          {[["Our Mission", aboutContent.mission], ["Our Vision", aboutContent.vision]].map(([t, d], i) => (
            <RevealOnScroll key={t} delay={i * 120} className={`px-2 py-16 md:px-12 md:py-24 ${i === 0 ? "md:border-r md:border-border" : "border-t border-border md:border-t-0"}`}>
              <p className="eyebrow">{t}</p>
              <p className="mt-5 font-serif text-3xl leading-snug md:text-4xl">{d}</p>
            </RevealOnScroll>
          ))}
        </div>
      </section>

      <section className="bg-primary text-primary-foreground">
        <div className="container-lux py-20 md:py-28">
          <div className="mx-auto max-w-4xl text-center">
            <p className="eyebrow !text-primary-foreground/60">A note from our founders</p>
            <RevealOnScroll as="blockquote" delay={120} className="mt-8 font-serif text-3xl italic leading-snug md:text-[2.75rem]">“{founderContent.quote}”</RevealOnScroll>
            <p className="mt-8 font-serif text-2xl">{founderContent.names}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] opacity-70">{founderContent.title}</p>
          </div>
        </div>
      </section>

      <section className="container-lux py-20 md:py-28">
        <div className="text-center">
          <p className="eyebrow">Our philosophy</p>
          <TextReveal text="What we stand for" className="mt-3 text-4xl md:text-5xl" />
        </div>
        <StaggerContainer step={80} className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {values.map(({ I, t, d }) => (
            <div key={t} className="rounded-2xl border border-border bg-card p-8">
              <I className="size-7 text-accent" strokeWidth={1.4} />
              <h3 className="mt-5 text-3xl">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d}</p>
            </div>
          ))}
        </StaggerContainer>
        <p className="mt-6 text-center text-xs text-muted-foreground">Product-specific claims (such as vegan or paraben-free) appear on each product only once confirmed.</p>
      </section>

      <section className="border-t border-border/60 bg-page py-20 text-center md:py-24">
        <div className="container-lux max-w-2xl">
          <TextReveal text="Find your everyday ritual" className="text-4xl md:text-5xl" />
          <Button variant="lux" size="xl" className="group mt-8" asChild><Link to="/shop">Shop the collection <ArrowRight className="arrow-nudge" /></Link></Button>
          <p className="mt-6 text-[11px] text-muted-foreground">{aboutContent.copyStatus}</p>
        </div>
      </section>
    </>
  );
}
