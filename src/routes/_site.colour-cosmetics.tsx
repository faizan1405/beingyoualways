import { createFileRoute } from "@tanstack/react-router";

import { ShopView } from "@/components/shop/ShopView";
import { productService } from "@/services/productService";

export const Route = createFileRoute("/_site/colour-cosmetics")({
  head: () => ({
    meta: [
      { title: "Colour Cosmetics | Being You – Always" },
      { name: "description", content: "Lip, cheek and complexion shades in soft, wearable tones." },
      { property: "og:title", content: "Colour Cosmetics | Being You – Always" },
      { property: "og:description", content: "Lip, cheek and complexion shades in soft, wearable tones." },
    ],
  }),
  loader: () => productService.list(),
  component: Page,
});

function Page() {
  const products = Route.useLoaderData();
  return <ShopView products={products} category="colour-cosmetics" title="Colour Cosmetics" intro="Lip, cheek and complexion shades in soft, wearable tones." />;
}
