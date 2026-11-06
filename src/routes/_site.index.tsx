import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Leaf, Sparkles, HeartHandshake } from "lucide-react";

import { FaqList, faqs } from "@/components/home/FaqList";
import { Hero } from "@/components/home/Hero";
import { ProductCard } from "@/components/shop/ProductCard";
import { ProductVisual } from "@/components/shop/ProductVisual";
import { Newsletter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import { productService } from "@/services/productService";

export const Route = createFileRoute("/_site/")({
  head: () => ({
    meta: [
      { title: "Being You – Always | Plant-Based Skincare, Haircare & Colour" },
      { name: "description", content: "Discover plant-based skincare, haircare and colour cosmetics from Being You – Always, an Indian beauty brand." },
      { property: "og:title", content: "Being You – Always | Plant-Based Beauty" },
      { property: "og:description", content: "Plant-based skincare, haircare and colour cosmetics for everyday rituals." },
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

function SectionHead({ eyebrow, title, link }: { eyebrow: string; title: string; link?: { to: "/shop"; label: string } }) {
  return (
    <div className="mb-10 flex items-end justify-between gap-6">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-3 text-4xl md:text-5xl">{title}</h2>
      </div>
      {link && <Link to={link.to} className="hidden items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary hover:underline md:flex">{link.label} <ArrowRight className="size-3.5" /></Link>}
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
            <Link key={c.slug} to={`/${c.slug}` as "/skincare"} className="group relative block overflow-hidden rounded-xl">
              <ProductVisual {...catVisual[c.slug]} label={c.name} variant={i + 1} className="aspect-[4/5] transition-transform duration-700 group-hover:scale-[1.04] md:aspect-[3/4]" />
              <div className="bg-veil absolute inset-0" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-primary-foreground">
                <p className="text-[11px] uppercase tracking-[0.2em] opacity-85">{c.tagline}</p>
                <h3 className="mt-1 text-4xl">{c.name}</h3>
                <span className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">Explore <ArrowRight className="size-3.5 transition group-hover:translate-x-1" /></span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-lux pb-24">
        <SectionHead eyebrow="Bestsellers · Sample products" title="Featured favourites" link={{ to: "/shop", label: "Shop all" }} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
          {featured.slice(0, 8).map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </div>
      </section>

      <section className="bg-secondary">
        <div className="container-lux grid items-center gap-12 py-20 md:grid-cols-2 md:py-28">
          <div className="grid grid-cols-2 gap-4">
            <ProductVisual shape="jar" tint="oklch(0.82 0.08 70)" label="Saffron Night Cream" variant={2} className="mt-12 rounded-xl" />
            <ProductVisual shape="bottle" tint="oklch(0.78 0.05 120)" label="Botanical shampoo" variant={0} className="rounded-xl !bg-card" />
          </div>
          <div>
            <p className="eyebrow">Our story</p>
            <h2 className="mt-3 text-4xl leading-tight md:text-6xl">Made for the you<br /><em>that's always been there.</em></h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              Being You – Always began with a simple belief: beauty should feel honest, gentle and personal. We create plant-based formulas inspired by Indian botanicals, designed to fit into real routines. (Draft brand copy — to be refined with the client.)
            </p>
            <Button variant="luxOutline" size="xl" className="mt-8" asChild><Link to="/about">Read our story</Link></Button>
          </div>
        </div>
      </section>

      <section className="container-lux py-20 md:py-28">
        <SectionHead eyebrow="Curated collections" title="Edits we love" />
        <div className="grid gap-5 md:grid-cols-[1.3fr_1fr]">
          {[
            { name: "The Glow Ritual", copy: "Serum, oil & night cream for a radiant routine.", shape: "dropper", tint: "oklch(0.7 0.11 60)", to: "/skincare" },
            { name: "Everyday Colour", copy: "Soft shades for lips and cheeks.", shape: "compact", tint: "oklch(0.7 0.1 10)", to: "/colour-cosmetics" },
          ].map((c, i) => (
            <Link key={c.name} to={c.to as "/skincare"} className="group relative flex min-h-[340px] items-end overflow-hidden rounded-xl bg-card md:min-h-[420px]">
              <ProductVisual shape={c.shape as "dropper"} tint={c.tint} label={c.name} variant={i + 2} className="absolute inset-0 !aspect-auto h-full w-full transition-transform duration-700 group-hover:scale-[1.03]" />
              <div className="bg-veil absolute inset-0" />
              <div className="relative p-8 text-primary-foreground">
                <h3 className="text-4xl md:text-5xl">{c.name}</h3>
                <p className="mt-2 max-w-xs text-sm opacity-85">{c.copy}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-primary text-primary-foreground">
        <div className="container-lux py-20 md:py-24">
          <p className="eyebrow !text-primary-foreground/60 text-center">Our philosophy</p>
          <h2 className="mx-auto mt-4 max-w-3xl text-center text-4xl leading-tight md:text-5xl">Rooted in plants. Made for self-care. Shaped by you.</h2>
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {[
              { I: Leaf, t: "Plant-based", d: "Formulas built around plant-derived ingredients, with full ingredient lists on every product." },
              { I: Sparkles, t: "Everyday rituals", d: "Simple routines that fit real life — a few mindful minutes, every day." },
              { I: HeartHandshake, t: "Made to be you", d: "Shades and textures that celebrate your natural self, not a filter." },
            ].map(({ I, t, d }) => (
              <div key={t} className="text-center">
                <I className="mx-auto size-6 text-accent" strokeWidth={1.4} />
                <h3 className="mt-4 text-2xl">{t}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm opacity-75">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-lux grid gap-10 py-20 md:grid-cols-[1fr_1.5fr] md:py-28">
        <div>
          <p className="eyebrow">Questions</p>
          <h2 className="mt-3 text-4xl md:text-5xl">Good to know</h2>
          <p className="mt-4 text-sm text-muted-foreground">Provisional answers — final policies will be confirmed before launch.</p>
          <Button variant="link" asChild className="mt-4 px-0 uppercase tracking-[0.14em] text-xs"><Link to="/faq">All FAQs →</Link></Button>
        </div>
        <FaqList items={faqs.slice(0, 4)} />
      </section>

      <Newsletter />
    </>
  );
}
