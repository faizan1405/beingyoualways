import { createFileRoute } from "@tanstack/react-router";

import { CollectionView } from "@/components/shop/CollectionView";
import { deTanSlugs } from "@/lib/concerns";
import { productService } from "@/services/productService";

const intro = "De-tan care to refresh sun-dulled skin and bring back an even-looking glow.";

export const Route = createFileRoute("/_site/de-tan-care")({
  head: () => ({
    meta: [
      { title: "De-Tan Care | Being You – Always" },
      { name: "description", content: intro },
      { property: "og:title", content: "De-Tan Care | Being You – Always" },
      { property: "og:description", content: intro },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: () => productService.bySlugs(deTanSlugs),
  component: () => <CollectionView eyebrow="Collection" title="De-Tan Care" intro={intro} products={Route.useLoaderData()} />,
});
