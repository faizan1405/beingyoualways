import { createFileRoute } from "@tanstack/react-router";

import { ShopView } from "@/components/shop/ShopView";
import { productService } from "@/services/productService";

export const Route = createFileRoute("/_site/haircare")({
  head: () => ({
    meta: [
      { title: "Haircare | Being You – Always" },
      { name: "description", content: "Botanical oils, shampoos and masks for soft, healthy-looking hair." },
      { property: "og:title", content: "Haircare | Being You – Always" },
      { property: "og:description", content: "Botanical oils, shampoos and masks for soft, healthy-looking hair." },
    ],
  }),
  loader: () => productService.list(),
  component: Page,
});

function Page() {
  const products = Route.useLoaderData();
  return <ShopView products={products} category="haircare" title="Haircare" intro="Botanical oils, shampoos and masks for soft, healthy-looking hair." />;
}
