import { createFileRoute } from "@tanstack/react-router";

import { ShopView } from "@/components/shop/ShopView";
import { productService } from "@/services/productService";

export const Route = createFileRoute("/_site/skincare")({
  head: () => ({
    meta: [
      { title: "Skincare | Being You – Always" },
      { name: "description", content: "Plant-based cleansers, serums and moisturisers for a calm, everyday ritual." },
      { property: "og:title", content: "Skincare | Being You – Always" },
      { property: "og:description", content: "Plant-based cleansers, serums and moisturisers for a calm, everyday ritual." },
    ],
  }),
  loader: () => productService.list(),
  component: Page,
});

function Page() {
  const products = Route.useLoaderData();
  return <ShopView products={products} category="skincare" title="Skincare" intro="Plant-based cleansers, serums and moisturisers for a calm, everyday ritual." />;
}
