import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { FounderQuote, ShopByConcern, WhyChooseUs, collections } from "@/components/home/HomeSections";
import { Testimonials } from "@/components/home/Testimonials";
import { ScrollStory } from "@/components/home/ScrollStory";

import { FaqList, faqs } from "@/components/home/FaqList";
import { Hero } from "@/components/home/Hero";
import { ProductCard } from "@/components/shop/ProductCard";
import { ProductVisual } from "@/components/shop/ProductVisual";
import { Newsletter } from "@/components/site/SiteFooter";
import { contactConfig } from "@/config/business";
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
  loader: async () => ({ featured: await productService.featured() }),
  component: Home,
});


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
  const { featured } = Route.useLoaderData();
  return (
    <>
      <Hero />

      <ShopByConcern />

      <section className="container-lux pb-24">
        <SectionHead eyebrow="Bestsellers · Sample products" title="Our best sellers" link={{ to: "/shop", label: "Shop all" }} />
        <StaggerContainer step={70} max={4} className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
          {featured.slice(0, 8).map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </StaggerContainer>
      </section>

      <section className="bg-secondary">
        <div className="container-lux grid items-center gap-12 py-20 md:grid-cols-2 md:py-28">
          <div className="relative mx-auto w-full max-w-lg pb-16 pr-10 md:pb-20 md:pr-16">
            <Parallax speed={-0.05}><ImageReveal className="overflow-hidden rounded-2xl shadow-[var(--shadow-soft)]"><img src={productImages("toner")[0]} alt="Being You toner among fresh fennel flowers" loading="lazy" decoding="async" className="aspect-[4/5] w-full object-cover" /></ImageReveal></Parallax>
            <Parallax speed={0.08} className="absolute bottom-0 right-0 w-[48%]"><ImageReveal from="left" delay={200} className="overflow-hidden rounded-2xl border-[6px] border-secondary shadow-lift"><img src={productImages("aloe-vera-gel")[0]} alt="Being You aloe vera gel with fresh aloe leaves" loading="lazy" decoding="async" className="aspect-square w-full object-cover" /></ImageReveal></Parallax>
            <span aria-hidden className="absolute -left-3 top-8 hidden rounded-full bg-background/90 px-4 py-2 font-serif text-sm italic text-foreground shadow-[var(--shadow-soft)] backdrop-blur md:block">Naturally you</span>
          </div>
          <div>
            <RevealOnScroll as="p" kind="fade" className="eyebrow">Our story</RevealOnScroll>
            <TextReveal by="line" text={["Made for the you", <em key="e">that's always been there.</em>]} className="mt-3 text-4xl leading-tight md:text-6xl" />
            <RevealOnScroll as="p" delay={300} className="mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              Being You – Always is a family-led Indian brand making plant-based skin and hair care — gentle, honest and effective products the founders trust for their own family, from their daughter to their mother.
            </RevealOnScroll>
            <RevealOnScroll delay={420}><Button variant="luxOutline" size="xl" className="group mt-8" asChild><Link to="/about">Read our story <ArrowRight className="arrow-nudge" /></Link></Button></RevealOnScroll>
          </div>
        </div>
      </section>

      <ScrollStory />

      <section className="container-lux py-20 md:py-28">
        <SectionHead eyebrow="Featured collections" title="Explore the range" link={{ to: "/shop", label: "Shop all" }} />
        <StaggerContainer step={70} className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {collections.map((c, i) => (
            <Link key={c.name} to={c.to} className={`group relative isolate flex min-h-[260px] flex-col justify-end overflow-hidden rounded-2xl p-6 text-primary-foreground shadow-[var(--shadow-soft)] transition-[transform,box-shadow] duration-500 hover:-translate-y-1 hover:shadow-lift md:min-h-[340px] ${i === 4 ? "col-span-2 md:col-span-1" : ""}`}>
              <div className={`absolute inset-0 -z-10 grid overflow-hidden ${c.images.length > 1 ? "grid-rows-2" : ""}`}>
                {c.images.map((src, j) => (
                  <img key={j} src={src} alt="" loading="lazy" decoding="async" style={{ objectPosition: c.pos }} className={`${"zoom" in c ? "h-[135%]" : "h-full"} w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.06]`} />
                ))}
              </div>
              <div aria-hidden className="absolute inset-0 -z-10 transition-opacity duration-500 group-hover:opacity-90" style={{ background: `linear-gradient(to top, color-mix(in oklab, ${c.tone} 92%, transparent) 0%, color-mix(in oklab, ${c.tone} 55%, transparent) 38%, transparent 68%, color-mix(in oklab, ${c.tone} 45%, transparent) 100%)` }} />
              <span className="absolute right-5 top-4 font-serif text-5xl italic opacity-80 [text-shadow:0_2px_12px_oklch(0_0_0/0.35)]">0{i + 1}</span>
              <h3 className="text-3xl leading-tight">{c.name}</h3>
              <p className="mt-1 text-xs opacity-85">{c.copy}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]">Discover <ArrowRight className="arrow-nudge size-3" /></span>
            </Link>
          ))}
        </StaggerContainer>
      </section>

      <Testimonials />

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

      <section className="container-lux py-16 text-center">
        <RevealOnScroll as="p" kind="fade" className="eyebrow">We're here for you</RevealOnScroll>
        <TextReveal text="Questions about your routine?" className="mt-3 text-4xl md:text-5xl" />
        <p className="mt-4 text-sm text-muted-foreground">Call <a className="font-semibold text-foreground hover:underline" href={`tel:${contactConfig.phones[0].tel}`}>{contactConfig.phones[0].display}</a> or email <a className="font-semibold text-foreground hover:underline" href={`mailto:${contactConfig.email}`}>{contactConfig.email}</a></p>
        <Button variant="luxOutline" size="xl" className="mt-6" asChild><Link to="/contact">Contact us</Link></Button>
      </section>
      <Newsletter />
    </>
  );
}
