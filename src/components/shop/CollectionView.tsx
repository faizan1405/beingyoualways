import { Link } from "@tanstack/react-router";
import { ArrowRight, Leaf } from "lucide-react";

import { StaggerContainer, TextReveal } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/button";
import { concerns } from "@/lib/concerns";
import type { Product } from "@/lib/types";
import { ProductCard } from "./ProductCard";

/** Header + product grid for curated collections and concerns, with a polished empty state. */
export function CollectionView({ eyebrow, title, intro, products, activeConcern }: { eyebrow: string; title: string; intro: string; products: Product[]; activeConcern?: string | undefined }) {
  return (
    <div>
      <section className="bg-secondary py-14 text-center md:py-20">
        <div className="container-lux">
          <p className="eyebrow hero-in">{eyebrow}</p>
          <TextReveal as="h1" text={title} className="mt-3 text-5xl md:text-7xl" />
          <p className="hero-in mx-auto mt-4 max-w-lg text-sm text-muted-foreground" style={{ animationDelay: "300ms" }}>{intro}</p>
        </div>
      </section>
      {activeConcern && (
        <nav aria-label="Concerns" className="container-lux -mb-2 flex gap-2 overflow-x-auto pt-8 pb-1">
          {concerns.map((c) => (
            <Link key={c.slug} to="/concern/$slug" params={{ slug: c.slug }}
              className={`press shrink-0 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${c.slug === activeConcern ? "border-primary bg-primary text-primary-foreground" : "border-input hover:border-primary"}`}>
              {c.name}
            </Link>
          ))}
        </nav>
      )}
      <div className="container-lux py-12">
        {products.length ? (
          <>
            <p className="mb-8 text-sm text-muted-foreground">{products.length} product{products.length > 1 ? "s" : ""} · sample catalogue</p>
            <StaggerContainer step={70} max={4} className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
              {products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
            </StaggerContainer>
          </>
        ) : (
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-border bg-card px-8 py-16 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-secondary text-primary"><Leaf className="size-6" strokeWidth={1.4} /></span>
            <h2 className="mt-5 text-3xl">Coming soon</h2>
            <p className="mt-2 text-sm text-muted-foreground">We're still preparing products for this edit. Explore the full range in the meantime.</p>
            <Button variant="lux" size="lg" className="group mt-6" asChild><Link to="/shop">Shop all <ArrowRight className="arrow-nudge" /></Link></Button>
          </div>
        )}
      </div>
    </div>
  );
}
