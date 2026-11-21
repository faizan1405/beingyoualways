import { galleryImages, productImages } from "@/lib/product-images";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Droplets, Eye, Feather, FlaskConical, Leaf, Rabbit, Sparkles, Sprout, Sun, Waves, Wind } from "lucide-react";

import { concerns, type ConcernSlug } from "@/lib/concerns";
import { globalStandardsContent, standForContent } from "@/config/business";
import { RevealOnScroll, StaggerContainer, TextReveal } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/home/Flags";

const icons: Record<ConcernSlug, typeof Sparkles> = {
  pigmentation: Sparkles, "acne-prone-skin": Droplets, "dull-dry-skin": Waves, "dark-circles": Eye,
  "sun-protection": Sun, "hair-fall": Wind, dandruff: Feather, "tan-removal": Leaf,
};

/** Real packshots per concern (clean product photo, slide 01) — chosen to match each concern without implying results. */
const concernArt: Record<ConcernSlug, { slug: string; tone: string }> = {
  pigmentation: { slug: "face-serum", tone: "oklch(0.36 0.05 45)" },
  "acne-prone-skin": { slug: "face-wash", tone: "var(--primary)" },
  "dull-dry-skin": { slug: "aloe-vera-gel", tone: "oklch(0.36 0.05 140)" },
  "dark-circles": { slug: "toner", tone: "oklch(0.33 0.03 260)" },
  "sun-protection": { slug: "sunscreen", tone: "oklch(0.42 0.08 50)" },
  "hair-fall": { slug: "hair-oil", tone: "oklch(0.34 0.04 100)" },
  dandruff: { slug: "hair-mask", tone: "oklch(0.34 0.03 180)" },
  "tan-removal": { slug: "volcanic-scrub", tone: "oklch(0.4 0.07 30)" },
};
const concernPhoto = (slug: string) => galleryImages(slug)[0] ?? productImages(slug)[0];

export function ShopByConcern() {
  return (
    <section className="container-lux py-20 md:py-28">
      <div className="flex flex-col items-center gap-5 text-center md:flex-row md:items-end md:justify-between md:text-left">
        <div>
          <RevealOnScroll as="p" kind="fade" className="eyebrow">Shop by concern</RevealOnScroll>
          <TextReveal text="What does your skin need?" className="mt-3 text-4xl md:text-5xl" delay={80} />
        </div>
        <RevealOnScroll kind="fade" delay={200}>
          <Button variant="luxOutline" size="lg" asChild>
            <Link to="/shop">View All <ArrowRight /></Link>
          </Button>
        </RevealOnScroll>
      </div>
      <StaggerContainer step={60} className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
        {concerns.map(({ slug, name: t }) => { const I = icons[slug]; const a = concernArt[slug]; return (
          <Link key={slug} to="/concern/$slug" params={{ slug }} className="group relative isolate flex aspect-[3/4] flex-col overflow-hidden rounded-2xl border border-border bg-page text-primary-foreground shadow-[var(--shadow-soft)] transition-[transform,box-shadow] duration-500 hover:-translate-y-1 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:aspect-[4/5]">
            <div className="relative min-h-0 flex-1">
              {concernPhoto(a.slug) && <img src={concernPhoto(a.slug)} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-contain p-1 scale-110 transition-transform duration-[1200ms] ease-out group-hover:scale-[1.16] md:p-2" />}
              <span className="absolute left-3 top-3 grid size-9 place-items-center rounded-full border border-border bg-background text-primary md:left-4 md:top-4 md:size-10"><I className="size-4" strokeWidth={1.5} /></span>
            </div>
            <div className="px-4 pb-4 pt-3 md:px-6 md:pb-5 md:pt-4" style={{ background: a.tone }}>
              <span className="block font-serif text-xl leading-tight md:text-2xl">{t}</span>
              <span className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] opacity-90">Shop <ArrowRight className="arrow-nudge size-3" /></span>
            </div>
          </Link>
        ); })}
      </StaggerContainer>
      <RevealOnScroll as="div" kind="fade" className="mt-10 flex flex-col items-center justify-between gap-5 rounded-3xl bg-secondary p-6 text-center md:flex-row md:p-8 md:text-left">
        <div>
          <p className="eyebrow">New · Explore by concern</p>
          <p className="mt-2 font-serif text-2xl md:text-3xl">See pigmentation, acne and haircare stories unfold as you scroll.</p>
        </div>
        <Button variant="lux" size="lg" className="shrink-0" asChild>
          <Link to="/explore-concerns">Explore by Concern <ArrowRight /></Link>
        </Button>
      </RevealOnScroll>
    </section>
  );
}

const standIcons = [FlaskConical, Sprout, Rabbit];

/** Original "What We Stand For" content from beingyoualways.com (claims pending client confirmation — see /admin/approvals). */
export function WhyChooseUs() {
  return (
    <section aria-label={standForContent.heading} className="relative overflow-hidden border-t border-border/60 bg-page">
      <div className="container-lux relative py-20 md:py-28">
        <RevealOnScroll as="p" kind="fade" className="eyebrow text-center">Our promise</RevealOnScroll>
        <TextReveal text={standForContent.heading} className="mx-auto mt-3 max-w-3xl text-center text-4xl leading-tight md:text-6xl" delay={80} />
        <RevealOnScroll kind="fade" delay={200} className="mx-auto mt-6 h-px w-16 bg-accent" />
        <StaggerContainer step={110} className="mt-14 grid gap-5 md:grid-cols-3 md:gap-6" itemClassName="h-full">
          {standForContent.items.map(({ title, text }, i) => {
            const I = standIcons[i] ?? Leaf;
            return (
              <article key={title} className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card p-7 transition-[transform,box-shadow,border-color] duration-500 ease-[var(--ease-lux)] hover:-translate-y-1 hover:border-sage hover:shadow-soft sm:p-8 md:p-10">
                <span className="relative grid size-16 place-items-center rounded-full border border-primary/15 bg-secondary text-primary transition-colors duration-500 group-hover:bg-primary group-hover:text-primary-foreground">
                  <I className="size-7" strokeWidth={1.2} />
                </span>
                <span className="mt-6 font-serif text-sm italic text-accent md:mt-8">0{i + 1}</span>
                <h3 className="mt-1 text-3xl md:text-[2.1rem]">{title}</h3>
                <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{text}</p>
              </article>
            );
          })}
        </StaggerContainer>
      </div>
    </section>
  );
}

/** Original "Global Standards" section: heading + six countries. Flags only — no certification or sourcing claims are added. */
export function GlobalStandards() {
  // Neutral heading: the old site's "importing ingredients" wording is unverified (see business.ts).
  const { displayHeading: heading, countries } = globalStandardsContent;
  return (
    <section aria-label={heading} className="container-lux py-20 md:py-28">
      <div className="text-center">
        <RevealOnScroll as="p" kind="fade" className="eyebrow">Around the world</RevealOnScroll>
        <TextReveal text={heading} className="mx-auto mt-3 max-w-3xl text-4xl leading-tight md:text-5xl" delay={80} />
      </div>
      <div className="relative mt-14 md:mt-16">
        <RevealOnScroll kind="line" delay={250} className="absolute inset-x-[8%] top-[calc(50%-1.25rem)] hidden h-px bg-gradient-to-r from-transparent via-accent to-transparent md:block" />
        <StaggerContainer step={90} max={6} className="relative grid grid-cols-3 gap-x-3 gap-y-8 sm:gap-x-6 md:grid-cols-6 md:gap-x-5">
          {countries.map(({ code, name }) => (
            <figure key={code} className="group flex flex-col items-center text-center">
              <div className="w-full rounded-2xl border border-border bg-card p-2.5 transition-[transform,box-shadow] duration-500 ease-[var(--ease-lux)] group-hover:-translate-y-1 group-hover:shadow-soft sm:p-3">
                <Flag code={code} title={name} className="block aspect-[3/2] w-full overflow-hidden rounded-lg ring-1 ring-border" />
              </div>
              <figcaption className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/80 sm:text-xs">{name}</figcaption>
            </figure>
          ))}
        </StaggerContainer>
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
