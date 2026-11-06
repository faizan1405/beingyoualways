import { Link } from "@tanstack/react-router";
import { Heart, Plus } from "lucide-react";

import { inr } from "@/lib/format";
import { useShop } from "@/lib/shop-store";
import type { Product } from "@/lib/types";
import { categories } from "@/lib/mock-data";
import { minPrice, totalStock } from "@/services/productService";
import { cn } from "@/lib/utils";
import { ProductVisual } from "./ProductVisual";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { add, toggleWish, isWished } = useShop();
  const wished = isWished(product.id);
  const first = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
  const out = totalStock(product) === 0;
  const cat = categories.find((c) => c.slug === product.category)?.name;
  const compare = product.variants[0].compareAtPrice;

  return (
    <article className="group relative flex flex-col">
      <div className="relative overflow-hidden rounded-lg">
        <Link to="/product/$slug" params={{ slug: product.slug }} aria-label={product.name}>
          <ProductVisual
            shape={product.shape} tint={product.tint} label={product.name} variant={index}
            className="transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        </Link>
        <button
          type="button"
          onClick={() => toggleWish(product.id)}
          aria-pressed={wished}
          aria-label={wished ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-card/90 shadow-soft backdrop-blur transition hover:scale-105"
        >
          <Heart className={cn("size-4", wished ? "fill-accent text-accent" : "text-foreground")} />
        </button>
        {out && <span className="absolute left-3 top-3 rounded-full bg-foreground/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-background">Sold out</span>}
        {!out && compare && <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">Offer</span>}
        <button
          type="button"
          disabled={out}
          onClick={() => add(product.id, first.id)}
          className="absolute inset-x-3 bottom-3 flex h-10 translate-y-0 items-center justify-center gap-1.5 rounded-full bg-primary text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground opacity-100 shadow-lift transition-all disabled:opacity-0 md:translate-y-3 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100"
        >
          <Plus className="size-3.5" /> Add {first.label}
        </button>
      </div>
      <div className="mt-4 flex flex-col gap-1">
        <p className="eyebrow !text-[10px]">{cat}</p>
        <Link to="/product/$slug" params={{ slug: product.slug }} className="font-serif text-xl leading-tight hover:text-primary">
          {product.name}
        </Link>
        <div className="flex items-baseline gap-2 text-sm">
          <span className="font-semibold">{product.variants.length > 1 ? "From " : ""}{inr(minPrice(product))}</span>
          {compare && <span className="text-muted-foreground line-through">{inr(compare)}</span>}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          {product.variants.map((v) =>
            v.swatch ? (
              <span key={v.id} title={v.label} className="size-3.5 rounded-full border border-border" style={{ background: v.swatch }} />
            ) : (
              <span key={v.id} className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">{v.label}</span>
            ),
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductGridSkeleton({ n = 8 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-[4/5] rounded-lg bg-secondary" />
          <div className="mt-4 h-3 w-16 rounded bg-secondary" />
          <div className="mt-2 h-5 w-3/4 rounded bg-secondary" />
        </div>
      ))}
    </div>
  );
}
