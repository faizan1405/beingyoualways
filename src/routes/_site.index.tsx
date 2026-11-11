import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { FounderQuote, GlobalStandards, ShopByConcern, WhyChooseUs, collections } from "@/components/home/HomeSections";
import { Testimonials } from "@/components/home/Testimonials";
import { ScrollStory } from "@/components/home/ScrollStory";
import { VideoReviews } from "@/components/home/VideoReviews";

import { FaqList, faqs } from "@/components/home/FaqList";
import { Hero } from "@/components/home/Hero";
import { ProductCard, ProductGridSkeleton } from "@/components/shop/ProductCard";
import { useHighDemand } from "@/hooks/use-high-demand";
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
  loader: async () => ({ highDemand: await productService.highDemand() }),
  component: Home,
});


function SectionHead({ id, eyebrow, title, link }: { id?: string | undefined; eyebrow: string; title: string; link?: { to: "/shop"; label: string } | undefined }) {
  return (
    <div className="mb-10 flex items-end justify-between gap-6">
      <div>
        <RevealOnScroll as="p" kind="fade" className="eyebrow">{eyebrow}</RevealOnScroll>
        <TextReveal id={id} text={title} className="mt-3 text-4xl md:text-5xl" delay={80} />
      </div>
      {link && <RevealOnScroll kind="fade" delay={250} className="hidden md:block"><Link to={link.to} className="group link-underline flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">{link.label} <ArrowRight className="arrow-nudge size-3.5" /></Link></RevealOnScroll>}
    </div>
  );
}

function Home() {
  const { highDemand: initialHighDemand } = Route.useLoaderData();
  const highDemand = useHighDemand(initialHighDemand);
  return (
    <>
      <Hero />

      <ShopByConcern />

      <section className="container-lux pb-20 md:pb-28" aria-labelledby="high-demand-h">
        <SectionHead id="high-demand-h" eyebrow="Selected by our team" title="High demand" link={{ to: "/shop", label: "Shop all" }} />
        {highDemand.list.length > 0 ? (
          <StaggerContainer key={highDemand.list.map((p) => p.id).join()} step={70} max={4} className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
            {highDemand.list.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </StaggerContainer>
        ) : !highDemand.ready ? (
          <ProductGridSkeleton n={4} />
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
            <Sparkles className="size-5 text-accent" strokeWidth={1.5} aria-hidden />
            <p className="mt-4 font-serif text-2xl">Our High Demand picks are on their way.</p>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">In the meantime, explore the full collection of plant-based skin, hair and colour care.</p>
            <Button variant="luxOutline" size="lg" className="mt-6" asChild><Link to="/shop">Shop the collection <ArrowRight /></Link></Button>
            <p className="mt-5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Preview · mark products as High Demand in Admin → Products</p>
          </div>
        )}
      </section>

      <section className="border-t border-border/60 bg-page">
        <div className="container-lux grid items-center gap-12 py-20 md:grid-cols-2 md:py-28">
          <div className="relative mx-auto w-full max-w-lg pb-16 pr-10 md:pb-20 md:pr-16">
            <Parallax speed={-0.05}><ImageReveal className="overflow-hidden rounded-2xl shadow-[var(--shadow-soft)]"><img src={productImages("toner")[0]} alt="Being You toner among fresh fennel flowers" loading="lazy" decoding="async" className="aspect-[4/5] w-full object-cover" /></ImageReveal></Parallax>
            <Parallax speed={0.08} className="absolute bottom-0 right-0 w-[48%]"><ImageReveal from="left" delay={200} className="overflow-hidden rounded-2xl border-[6px] border-page shadow-lift"><img src={productImages("aloe-vera-gel")[0]} alt="Being You aloe vera gel with fresh aloe leaves" loading="lazy" decoding="async" className="aspect-square w-full object-cover" /></ImageReveal></Parallax>
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
              <span aria-hidden className="absolute right-5 top-4 font-serif text-2xl italic opacity-75">0{i + 1}</span>
              <h3 className="text-3xl leading-tight">{c.name}</h3>
              <p className="mt-1 text-xs opacity-85">{c.copy}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]">Discover <ArrowRight className="arrow-nudge size-3" /></span>
            </Link>
          ))}
        </StaggerContainer>
      </section>

      <Testimonials />

      <VideoReviews />

      <GlobalStandards />

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

      <section className="container-lux py-20 text-center md:py-24">
        <RevealOnScroll as="p" kind="fade" className="eyebrow">We're here for you</RevealOnScroll>
        <TextReveal text="Questions about your routine?" className="mt-3 text-4xl md:text-5xl" />
        <p className="mt-4 text-sm text-muted-foreground">Call <a className="font-semibold text-foreground hover:underline" href={`tel:${contactConfig.phones[0].tel}`}>{contactConfig.phones[0].display}</a> or email <a className="font-semibold text-foreground hover:underline" href={`mailto:${contactConfig.email}`}>{contactConfig.email}</a></p>
        <Button variant="luxOutline" size="xl" className="mt-6" asChild><Link to="/contact">Contact us <ArrowRight /></Link></Button>
      </section>
      <Newsletter />
    </>
  );
}
