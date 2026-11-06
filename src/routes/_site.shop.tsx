import { createFileRoute } from "@tanstack/react-router";

import { ShopView } from "@/components/shop/ShopView";
import { productService } from "@/services/productService";

export const Route = createFileRoute("/_site/shop")({
  validateSearch: (s: Record<string, unknown>): { q?: string | undefined} => ({ q: typeof s.q === "string" ? s.q : undefined }),
  head: () => ({
    meta: [
      { title: "Shop All | Being You – Always" },
      { name: "description", content: "Shop the full Being You – Always range of plant-based skincare, haircare and colour cosmetics." },
      { property: "og:title", content: "Shop All | Being You – Always" },
      { property: "og:description", content: "The full plant-based beauty collection." },
    ],
  }),
  loader: () => productService.list(),
  component: Shop,
});

function Shop() {
  const products = Route.useLoaderData();
  const { q } = Route.useSearch();
  return <ShopView key={q ?? ""} products={products} title="Shop All" intro="Every ritual, in one place — skincare, haircare and colour." initialQuery={q ?? ""} />;
}
