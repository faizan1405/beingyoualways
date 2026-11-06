import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, HandHeart, ShieldCheck } from "lucide-react";

import { ProductVisual } from "@/components/shop/ProductVisual";
import { Button } from "@/components/ui/button";
import { ImageReveal, Parallax, RevealOnScroll, StaggerContainer, TextReveal } from "@/components/motion/Reveal";
import { productImages } from "@/lib/product-images";

export const Route = createFileRoute("/_site/about")({
  head: () => ({
    meta: [
      { title: "About Us | Being You – Always" },
      { name: "description", content: "Meet Being You – Always: a family-led Indian brand making plant-based skin and hair care, founded by Priyanka & Anirudhh Rajput." },
      { property: "og:title", content: "About Us | Being You – Always" },
      { property: "og:description", content: "A family-led brand of gentle, honest, effective plant-based care." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: About,
});

function About() {
  return (
    <>
      <section className="bg-secondary py-20 text-center md:py-28">
        <div className="container-lux max-w-3xl">
          <p className="eyebrow hero-in">About us</p>
          <TextReveal as="h1" by="line" text={["Nature-powered care,", <><em>made for family.</em></>]} className="mt-4 text-5xl leading-tight md:text-7xl" delay={120} />
          <p className="hero-in mx-auto mt-6 max-w-xl text-[15px] text-muted-foreground" style={{ animationDelay: "500ms" }}>Plant-based skin care, hair care and colour cosmetics from India.</p>
        </div>
      </section>

      <section className="container-lux grid items-center gap-12 py-20 md:grid-cols-2 md:py-28">
        <Parallax speed={-0.05}><ImageReveal className="rounded-xl"><ProductVisual src={productImages("saffron-night-cream")[1]} shape="jar" tint="oklch(0.82 0.08 70)" label="Being You ritual" variant={2} /></ImageReveal></Parallax>
        <RevealOnScroll kind="slide-right" delay={150} className="space-y-5 text-[15px] leading-relaxed text-muted-foreground">
          <p className="eyebrow">Our story</p>
          <h2 className="text-4xl leading-tight text-foreground md:text-5xl">Trust starts at home.</h2>
          <p>Being You – Always is led by co-founders Priyanka and Anirudhh Rajput. Their family — from their 9-year-old daughter to their 64-year-old mother — uses Being You products every day.</p>
          <p>That shapes one simple rule for the brand: if they wouldn't choose a product for their own family, they won't create it for yours.</p>
          <p>Today the range spans skin care, hair care, de-tan care and colour cosmetics — plant-based care offering natural, nourishing solutions for everyday routines.</p>
          <p className="text-xs italic">Longer founding story (year, location, milestones) pending client approval.</p>
          <Button variant="lux" size="xl" className="group" asChild><Link to="/shop">Explore the range <ArrowRight className="arrow-nudge" /></Link></Button>
        </RevealOnScroll>
      </section>

      <section className="bg-primary text-primary-foreground">
        <div className="container-lux py-20 md:py-28">
          <div className="mx-auto max-w-4xl text-center">
            <p className="eyebrow !text-primary-foreground/60">From our founders</p>
            <RevealOnScroll as="blockquote" delay={120} className="mt-8 font-serif text-3xl italic leading-snug md:text-[2.75rem]">
              “From our 9-year-old daughter to our 64-year-old mother, our family trusts many Being You Always products every day. That trust is our biggest responsibility. If we wouldn't choose it for our own family, we wouldn't create it for yours.”
            </RevealOnScroll>
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] opacity-80">Priyanka & Anirudhh Rajput · Co-Founders</p>
          </div>
        </div>
      </section>

      <section className="container-lux py-20 md:py-28">
        <div className="text-center">
          <p className="eyebrow">What we stand for</p>
          <TextReveal text="Three promises" className="mt-3 text-4xl md:text-5xl" />
        </div>
        <StaggerContainer step={100} className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            { I: HandHeart, t: "Gentle", d: "Care that's soft on you and the planet." },
            { I: BadgeCheck, t: "Honest", d: "Transparent ingredients with nothing to hide." },
            { I: ShieldCheck, t: "Effective", d: "Results you can see, care you can trust." },
          ].map(({ I, t, d }) => (
            <div key={t} className="rounded-2xl border border-border bg-card p-8 text-center">
              <I className="mx-auto size-7 text-accent" strokeWidth={1.4} />
              <h3 className="mt-4 text-3xl">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </StaggerContainer>
      </section>
    </>
  );
}
