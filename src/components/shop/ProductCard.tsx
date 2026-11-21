import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Heart, Plus } from "lucide-react";
import { useRef, useState } from "react";

import { inr } from "@/lib/format";
import { useShop } from "@/lib/shop-store";
import type { Product } from "@/lib/types";
import { isUnconfirmed, mrpOf, requiresChoice, variantKindLabel } from "@/lib/variants";
import { minPrice, totalStock } from "@/services/productService";
import { cn } from "@/lib/utils";
import { ProductVisual } from "./ProductVisual";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number | undefined }) {
  const { add, toggleWish, isWished } = useShop();
  const wished = isWished(product.id);
  const [pop, setPop] = useState(0);
  const [added, setAdded] = useState(false);
  const busy = useRef(false);
  const choose = requiresChoice(product);
  const only = product.variants[0];
  const out = totalStock(product) === 0;
  const mrp = choose ? null : mrpOf(only);
  const kind = variantKindLabel(product);
  const fromPrice = choose && new Set(product.variants.map((v) => v.price)).size > 1;
  const actionCls = "btn-motion btn-fill relative flex h-11 w-full items-center justify-center gap-1.5 rounded-btn border border-primary/70 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary transition-colors hover:text-primary-foreground [--btn-fill:var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const quickAdd = () => {
    if (busy.current || !only) return;
    busy.current = true;
    const r = add(product.id, only.id);
    if (r.ok) { setAdded(true); setTimeout(() => setAdded(false), 1400); }
    setTimeout(() => { busy.current = false; }, 600);
  };

  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative overflow-hidden rounded-lg ring-1 ring-transparent transition-[box-shadow,transform] duration-500 ease-[var(--ease-lux)] group-hover:-translate-y-1 group-hover:shadow-lift group-hover:ring-border">
        <Link to="/product/$slug" params={{ slug: product.slug }} aria-label={product.name}>
          <ProductVisual
            src={product.images?.[0]} shape={product.shape} tint={product.tint} label={product.name} variant={index}
            className="aspect-square transition-transform duration-[1100ms] ease-[var(--ease-lux)] group-hover:scale-[1.06]"
          />
        </Link>
        <button
          type="button"
          onClick={() => { toggleWish(product.id); setPop((n) => n + 1); }}
          aria-pressed={wished}
          aria-label={wished ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          className="press absolute right-3 top-3 grid size-10 place-items-center rounded-full border border-border/60 bg-card/90 shadow-soft backdrop-blur transition-colors duration-200 hover:border-accent"
        >
          <Heart key={pop} className={cn("size-4 transition-colors", pop > 0 && "heart-pop", wished ? "fill-accent text-accent" : "text-foreground")} />
        </button>
        {out && <span className="absolute left-3 top-3 rounded-full bg-foreground/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-background">Unavailable</span>}
        {!out && mrp && <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">Offer</span>}
      </div>
      <div className="mt-4 flex flex-1 flex-col">
        {/* Ratings/review counts render here only once verified review data exists — never placeholder numbers. */}
        <Link to="/product/$slug" params={{ slug: product.slug }} className="line-clamp-2 font-serif text-lg leading-snug transition-colors hover:text-primary md:text-xl">
          {product.name}
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="font-serif text-2xl font-semibold leading-none text-primary md:text-[1.7rem]">
            {fromPrice && <span className="mr-1 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">From</span>}
            {inr(minPrice(product))}
          </span>
          {mrp && <span className="text-sm text-muted-foreground line-through"><span className="sr-only">MRP </span>{inr(mrp)}</span>}
          {mrp && mrp > minPrice(product) && <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">Save {inr(mrp - minPrice(product))}</span>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {product.variants.some((v) => v.swatch) ? (
            <>
              {product.variants.map((v) => v.swatch && <span key={v.id} title={v.label} className="size-3.5 rounded-full border border-border" style={{ background: v.swatch }} />)}
              <span className="text-[11px] text-muted-foreground">{product.variants.length} {kind}s</span>
            </>
          ) : (
            product.variants.filter((v) => !isUnconfirmed(v.label)).map((v) => (
              <span key={v.id} className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">{v.label}</span>
            ))
          )}
        </div>
        <div className="mt-auto pt-4">
          {out ? (
            <span className={cn(actionCls, "cursor-default border-border text-muted-foreground")}>Unavailable</span>
          ) : choose ? (
            <Link to="/product/$slug" params={{ slug: product.slug }} className={actionCls} aria-label={`Choose a ${kind} for ${product.name}`}>
              Choose {kind} <ArrowRight className="size-3.5" />
            </Link>
          ) : (
            <button type="button" onClick={quickAdd} className={actionCls} aria-label={`Add ${product.name} to bag`}>
              {added ? <><Check className="size-3.5" /> Added</> : <><Plus className="size-3.5 transition-transform duration-300 group-hover:rotate-90" /> Add to bag</>}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductGridSkeleton({ n = 8 }: { n?: number | undefined }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i}>
          <div className="skeleton-shimmer aspect-square rounded-lg" />
          <div className="skeleton-shimmer mt-4 h-3 w-16 rounded" />
          <div className="skeleton-shimmer mt-2 h-5 w-3/4 rounded" />
        </div>
      ))}
    </div>
  );
}
