import { Link } from "@tanstack/react-router";
import { chipVariants } from "@/components/ui/button";
import { SearchX } from "lucide-react";
import { useMemo, useState } from "react";

import { Slider } from "@/components/ui/slider";
import { categories } from "@/lib/mock-data";
import { inr } from "@/lib/format";
import type { CategorySlug, Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { filterProducts, type SortKey } from "@/services/productService";
import { ProductCard } from "./ProductCard";
import { RevealOnScroll, TextReveal } from "@/components/motion/Reveal";

const MAX = 1600;

export function ShopView({
  products, title, intro, category, initialQuery = "",
}: { products: Product[]; title: string; intro: string; category?: CategorySlug | undefined; initialQuery?: string | undefined}) {
  const [q, setQ] = useState(initialQuery);
  const [cat, setCat] = useState<CategorySlug | undefined>(category);
  const [max, setMax] = useState(MAX);
  const [sort, setSort] = useState<SortKey>("featured");

  const list = useMemo(
    () => filterProducts(products, { q, category: cat, maxPrice: max >= MAX ? undefined : max, sort }),
    [products, q, cat, max, sort],
  );

  return (
    <div>
      <section className="bg-secondary py-14 text-center md:py-20">
        <div className="container-lux">
          <p className="eyebrow hero-in">Collection</p>
          <TextReveal as="h1" text={title} className="mt-3 text-5xl md:text-7xl" />
          <p className="hero-in mx-auto mt-4 max-w-lg text-sm text-muted-foreground" style={{ animationDelay: "300ms" }}>{intro}</p>
        </div>
      </section>

      <div className="container-lux py-10">
        <div className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
          {!category && (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter by category">
              {[{ slug: undefined, name: "All" }, ...categories].map((c) => (
                <button
                  key={c.name}
                  onClick={() => setCat(c.slug as CategorySlug | undefined)}
                  aria-pressed={cat === c.slug}
                  className={chipVariants({ active: cat === c.slug })}
                >{c.name}</button>
              ))}
            </div>
          )}
          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3 lg:max-w-3xl lg:ml-auto">
            <div>
              <label htmlFor="shop-q" className="eyebrow">Search</label>
              <input id="shop-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="mt-2 h-10 w-full rounded-full border border-input bg-card px-4 text-sm outline-none focus:border-primary" />
            </div>
            <div>
              <span id="price-lbl" className="eyebrow">Max price · {max >= MAX ? "Any" : inr(max)}</span>
              <Slider aria-labelledby="price-lbl" className="mt-5" min={300} max={MAX} step={50} value={[max]} onValueChange={([v]) => setMax(v ?? MAX)} />
            </div>
            <div>
              <label htmlFor="shop-sort" className="eyebrow">Sort by</label>
              <select id="shop-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="mt-2 h-10 w-full rounded-full border border-input bg-card px-4 text-sm outline-none focus:border-primary">
                <option value="featured">Featured</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>
          </div>
        </div>

        <p className="py-6 text-sm text-muted-foreground" aria-live="polite">{list.length} {list.length === 1 ? "product" : "products"}</p>

        {list.length === 0 ? (
          <div className="animate-in fade-in zoom-in-95 flex flex-col items-center gap-4 py-24 text-center duration-500">
            <SearchX className="size-10 text-muted-foreground" strokeWidth={1.2} />
            <p className="font-serif text-3xl">Nothing matches just yet</p>
            <p className="text-sm text-muted-foreground">Try a different search or widen your price range.</p>
            <button onClick={() => { setQ(""); setMax(MAX); setCat(category); }} className="text-xs font-semibold uppercase tracking-[0.14em] text-primary underline underline-offset-4">Clear filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
            {list.map((p, i) => <RevealOnScroll key={p.id} delay={(i % 4) * 70}><ProductCard product={p} index={i} /></RevealOnScroll>)}
          </div>
        )}

        {category && (
          <p className="mt-16 text-center text-sm text-muted-foreground">
            Looking for more? <Link to="/shop" className="text-primary underline underline-offset-4">Browse the full collection</Link>
          </p>
        )}
      </div>
    </div>
  );
}
