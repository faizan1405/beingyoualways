import { Link } from "@tanstack/react-router";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { ArrowRight } from "lucide-react";

import { RevealOnScroll, TextReveal } from "@/components/motion/Reveal";
import { ProductCard } from "@/components/shop/ProductCard";
import { chipVariants } from "@/components/ui/button";
import { useLiveProducts } from "@/hooks/use-live-products";
import { homeCategoryGroups } from "@/lib/concerns";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

const activeOnly = (all: Product[]) => all.filter((p) => p.status === "active");

/** Products for one group, in the client's order. Same records as the shop — hidden drafts drop out. */
export const productsForGroup = (all: Product[], slugs: string[]): Product[] =>
  slugs.flatMap((slug) => all.filter((p) => p.slug === slug && p.status === "active"));

/** Homepage "Shop by category": tabs of real products grouped as the client listed them. */
export function CategoryShop({ products: initial }: { products: Product[] }) {
  const all = useLiveProducts(initial, activeOnly);
  const groups = homeCategoryGroups.map((g) => ({ ...g, list: productsForGroup(all, g.slugs) })).filter((g) => g.list.length > 0);
  const first = groups[0];
  if (!first) return null;

  return (
    <section className="container-lux pb-20 md:pb-28" aria-labelledby="category-shop-h">
      <div className="text-center">
        <RevealOnScroll as="p" kind="fade" className="eyebrow">For your beauty</RevealOnScroll>
        <TextReveal id="category-shop-h" text="Shop by category" className="mt-3 text-4xl md:text-5xl" delay={80} />
      </div>

      <TabsPrimitive.Root defaultValue={first.key} className="mt-8 md:mt-10">
        <TabsPrimitive.List aria-label="Product categories" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
          {groups.map((g) => (
            <TabsPrimitive.Trigger
              key={g.key}
              value={g.key}
              className={cn(chipVariants({ active: false }), "data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground")}
            >
              {g.label}
              <span className="ml-1.5 text-[10px] opacity-60">{g.list.length}</span>
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>

        {groups.map((g) => (
          <TabsPrimitive.Content key={g.key} value={g.key} className="mt-10 animate-in fade-in duration-500 focus-visible:outline-none">
            <div className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
              {g.list.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
            </div>
            <div className="mt-10 text-center">
              <Link to={g.to} className="group link-underline inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                View all {g.label} <ArrowRight className="arrow-nudge size-3.5" />
              </Link>
            </div>
          </TabsPrimitive.Content>
        ))}
      </TabsPrimitive.Root>
    </section>
  );
}
