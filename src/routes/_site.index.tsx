import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { FounderQuote, ShopByConcern, WhyChooseUs, collections } from "@/components/home/HomeSections";
import { RealResults, Testimonials } from "@/components/home/Testimonials";

import { FaqList, faqs } from "@/components/home/FaqList";
import { Hero } from "@/components/home/Hero";
import { ProductCard } from "@/components/shop/ProductCard";
import { ProductVisual } from "@/components/shop/ProductVisual";
import { Newsletter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import { ImageReveal, Parallax, RevealOnScroll, StaggerContainer, TextReveal } from "@/components/motion/Reveal";
import { productImages } from "@/lib/product-images";
import { productService } from "@/services/productService";

export const Route = createFileRoute("/_site/")({
  head: () => ({
    meta: [
      { title: "Being You – Always | Plant-Based Skincare, Haircare & Colour" },
      { name: "description", content: "Discover plant-based skincare, haircare and colour cosmetics from Being You – Always, an Indian beauty brand." },
      { property: "og:title", content: "Being You – Always | Plant-Based Beauty" },
      { property: "og:description", content: "Plant-based skincare, haircare and colour cosmetics for everyday rituals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async () => ({ featured: await productService.featured(), categories: await productService.categories() }),
  component: Home,
});

const catVisual = {
  skincare: { shape: "dropper", tint: "oklch(0.82 0.06 20)" },
  haircare: { shape: "bottle", tint: "oklch(0.72 0.09 85)" },
  "colour-cosmetics": { shape: "lipstick", tint: "oklch(0.58 0.12 40)" },
} as const;

function SectionHead({ eyebrow, title, link }: { eyebrow: string; title: string; link?: { to: "/shop"; label: string } | undefined }) {
  return (
    <div className="mb-10 flex items-end justify-between gap-6">
      <div>
        <RevealOnScroll as="p" kind="fade" className="eyebrow">{eyebrow}</RevealOnScroll>
        <TextReveal text={title} className="mt-3 text-4xl md:text-5xl" delay={80} />
      </div>
      {link && <RevealOnScroll kind="fade" delay={250} className="hidden md:block"><Link to={link.to} className="group link-underline flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">{link.label} <ArrowRight className="arrow-nudge size-3.5" /></Link></RevealOnScroll>}
    </div>
  );
}

function Home() {
  const { featured, categories } = Route.useLoaderData();
  return (
    <>
      <Hero />

      <section className="container-lux py-20 md:py-28">
        <SectionHead eyebrow="Shop by category" title="Find your ritual" />
        <div className="grid gap-5 md:grid-cols-3">
          {categories.map((c, i) => (
            <ImageReveal key={c.slug} delay={i * 110} className="rounded-xl">
            <Link to={`/${c.slug}` as "/skincare"} className="group relative block overflow-hidden rounded-xl">
              <ProductVisual {...catVisual[c.slug]} label={c.name} variant={i + 1} tag={false} className="aspect-[4/5] transition-transform duration-[1200ms] ease-[var(--ease-lux)] group-hover:scale-[1.06] md:aspect-[3/4]" />
              <div className="bg-veil absolute inset-0 transition-opacity duration-500 group-hover:opacity-90" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-primary-foreground transition-transform duration-500 ease-[var(--ease-lux)] group-hover:-translate-y-2">
                <p className="text-[11px] uppercase tracking-[0.2em] opacity-85">{c.tagline}</p>
                <h3 className="mt-1 text-4xl tracking-normal transition-[letter-spacing] duration-500 group-hover:tracking-wide">{c.name}</h3>
                <span className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">Explore <ArrowRight className="arrow-nudge size-3.5" /></span>
              </div>
            </Link>
            </ImageReveal>
          ))}
        </div>
      </section>

      <ShopByConcern />

      <section className="container-lux pb-24">
        <SectionHead eyebrow="Bestsellers · Sample products" title="Our best sellers" link={{ to: "/shop", label: "Shop all" }} />
        <StaggerContainer step={70} max={4} className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
          {featured.slice(0, 8).map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </StaggerContainer>
      </section>

      <section className="bg-secondary">
        <div className="container-lux grid items-center gap-12 py-20 md:grid-cols-2 md:py-28">
          <div className="grid grid-cols-2 gap-4">
            <Parallax speed={-0.06}><ImageReveal className="mt-12 rounded-xl"><ProductVisual src={productImages("saffron-night-cream")[1]} shape="jar" tint="oklch(0.82 0.08 70)" label="Saffron Night Cream" variant={2} /></ImageReveal></Parallax>
            <Parallax speed={0.06}><ImageReveal from="left" delay={150} className="rounded-xl"><ProductVisual shape="bottle" tint="oklch(0.78 0.05 120)" label="Reetha Shikakai Shampoo" variant={0} className="!bg-card" src={productImages("reetha-shikakai-shampoo")[1]} /></ImageReveal></Parallax>
          </div>
          <div>
            <RevealOnScroll as="p" kind="fade" className="eyebrow">Our story</RevealOnScroll>
            <TextReveal by="line" text={["Made for the you", <em key="e">that's always been there.</em>]} className="mt-3 text-4xl leading-tight md:text-6xl" />
            <RevealOnScroll as="p" delay={300} className="mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              Being You – Always began with a simple belief: beauty should feel honest, gentle and personal. We create plant-based formulas inspired by Indian botanicals, designed to fit into real routines. (Draft brand copy — to be refined with the client.)
            </RevealOnScroll>
            <RevealOnScroll delay={420}><Button variant="luxOutline" size="xl" className="group mt-8" asChild><Link to="/about">Read our story <ArrowRight className="arrow-nudge" /></Link></Button></RevealOnScroll>
          </div>
        </div>
      </section>

      <RealResults />

      <Testimonials />

      <section className="container-lux py-20 md:py-28">
        <SectionHead eyebrow="Featured collections" title="Explore the range" link={{ to: "/shop", label: "Shop all" }} />
        <StaggerContainer step={70} className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {collections.map((c, i) => (
            <Link key={c.name} to={c.to} className={`group relative flex min-h-[220px] flex-col justify-end overflow-hidden rounded-2xl p-6 transition-transform duration-500 hover:-translate-y-1 md:min-h-[300px] ${i % 2 ? "bg-secondary" : "bg-primary text-primary-foreground"} ${i === 4 ? "col-span-2 md:col-span-1" : ""}`}>
              <span className="absolute right-5 top-5 font-serif text-5xl italic opacity-20">0{i + 1}</span>
              <h3 className="text-3xl leading-tight">{c.name}</h3>
              <p className="mt-1 text-xs opacity-75">{c.copy}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]">Discover <ArrowRight className="arrow-nudge size-3" /></span>
            </Link>
          ))}
        </StaggerContainer>
      </section>

      <WhyChooseUs />

      <FounderQuote />

      <section className="container-lux grid gap-10 py-20 md:grid-cols-[1fr_1.5fr] md:py-28">
        <div>
          <RevealOnScroll as="p" kind="fade" className="eyebrow">Questions</RevealOnScroll>
          <TextReveal text="Good to know" className="mt-3 text-4xl md:text-5xl" />
          <p className="mt-4 text-sm text-muted-foreground">Provisional answers — final policies will be confirmed before launch.</p>
          <Button variant="link" asChild className="mt-4 px-0 uppercase tracking-[0.14em] text-xs"><Link to="/faq">All FAQs →</Link></Button>
        </div>
        <RevealOnScroll kind="slide-right" delay={150}><FaqList items={faqs.slice(0, 4)} /></RevealOnScroll>
      </section>

      <Newsletter />
    </>
  );
}
