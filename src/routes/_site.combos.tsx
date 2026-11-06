import { createFileRoute } from "@tanstack/react-router";

import { CollectionView } from "@/components/shop/CollectionView";
import { comboSlugs } from "@/lib/concerns";
import { productService } from "@/services/productService";

const intro = "Complete rituals, thoughtfully paired — and better value together.";

export const Route = createFileRoute("/_site/combos")({
  head: () => ({
    meta: [
      { title: "Combos | Being You – Always" },
      { name: "description", content: intro },
      { property: "og:title", content: "Combos | Being You – Always" },
      { property: "og:description", content: intro },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: () => productService.bySlugs(comboSlugs),
  component: () => <CollectionView eyebrow="Collection" title="Combos" intro={intro} products={Route.useLoaderData()} />,
});
