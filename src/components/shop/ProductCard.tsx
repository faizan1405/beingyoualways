import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Heart, Plus } from "lucide-react";
import { useRef, useState } from "react";

import { inr } from "@/lib/format";
import { useShop } from "@/lib/shop-store";
import type { Product } from "@/lib/types";
import { categories } from "@/lib/mock-data";
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
  const cat = categories.find((c) => c.slug === product.category)?.name;
  const mrp = choose ? null : mrpOf(only);
  const kind = variantKindLabel(product);
  const quickCls = "absolute inset-x-3 bottom-3 flex h-11 items-center justify-center gap-1.5 rounded-full bg-primary text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground shadow-lift transition-all duration-300 ease-[var(--ease-lux)] active:scale-[0.97] md:translate-y-3 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:focus-visible:translate-y-0 md:focus-visible:opacity-100";

  const quickAdd = () => {
    if (busy.current || !only) return;
    busy.current = true;
    const r = add(product.id, only.id);
    if (r.ok) { setAdded(true); setTimeout(() => setAdded(false), 1400); }
    setTimeout(() => { busy.current = false; }, 600);
  };

  return (
    <article className="group relative flex flex-col">
      <div className="relative overflow-hidden rounded-lg ring-1 ring-transparent transition-[box-shadow,transform] duration-500 ease-[var(--ease-lux)] group-hover:-translate-y-1 group-hover:shadow-lift group-hover:ring-border">
        <Link to="/product/$slug" params={{ slug: product.slug }} aria-label={product.name}>
          <ProductVisual
            src={product.images?.[0]} shape={product.shape} tint={product.tint} label={product.name} variant={index}
            className="transition-transform duration-[1100ms] ease-[var(--ease-lux)] group-hover:scale-[1.06]"
          />
        </Link>
        <button
          type="button"
          onClick={() => { toggleWish(product.id); setPop((n) => n + 1); }}
          aria-pressed={wished}
          aria-label={wished ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          className="press absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-card/90 shadow-soft backdrop-blur transition hover:scale-110"
        >
          <Heart key={pop} className={cn("size-4 transition-colors", pop > 0 && "heart-pop", wished ? "fill-accent text-accent" : "text-foreground")} />
        </button>
        {out && <span className="absolute left-3 top-3 rounded-full bg-foreground/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-background">Unavailable</span>}
        {!out && mrp && <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">Offer</span>}
        {!out && (choose ? (
          <Link to="/product/$slug" params={{ slug: product.slug }} className={quickCls} aria-label={`Choose a ${kind} for ${product.name}`}>
            Choose {kind} <ArrowRight className="size-3.5" />
          </Link>
        ) : (
          <button type="button" onClick={quickAdd} className={quickCls} aria-label={`Add ${product.name} to bag`}>
            {added ? <><Check className="size-3.5" /> Added</> : <><Plus className="size-3.5 transition-transform duration-300 group-hover:rotate-90" /> Add to bag</>}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-1">
        <p className="eyebrow !text-[10px]">{cat}</p>
        <Link to="/product/$slug" params={{ slug: product.slug }} className="font-serif text-xl leading-tight hover:text-primary">
          {product.name}
        </Link>
        <div className="flex items-baseline gap-2 text-sm">
          <span className="font-semibold">{choose && new Set(product.variants.map((v) => v.price)).size > 1 ? "From " : ""}{inr(minPrice(product))}</span>
          {mrp && <span className="text-muted-foreground line-through"><span className="sr-only">MRP </span>{inr(mrp)}</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
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
      </div>
    </article>
  );
}

export function ProductGridSkeleton({ n = 8 }: { n?: number | undefined }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i}>
          <div className="skeleton-shimmer aspect-[4/5] rounded-lg" />
          <div className="skeleton-shimmer mt-4 h-3 w-16 rounded" />
          <div className="skeleton-shimmer mt-2 h-5 w-3/4 rounded" />
        </div>
      ))}
    </div>
  );
}
