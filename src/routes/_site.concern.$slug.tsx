import { Link, createFileRoute, notFound } from "@tanstack/react-router";

import { CollectionView } from "@/components/shop/CollectionView";
import { getConcern } from "@/lib/concerns";
import { productService } from "@/services/productService";

export const Route = createFileRoute("/_site/concern/$slug")({
  loader: async ({ params }) => {
    const concern = getConcern(params.slug);
    if (!concern) throw notFound();
    return { concern, products: await productService.byConcern(concern.slug) };
  },
  head: ({ loaderData }) => {
    const n = loaderData?.concern.name ?? "Shop by concern";
    const d = loaderData?.concern.blurb ?? "Plant-based care by skin and hair concern.";
    return {
      meta: [
        { title: `${n} | Shop by Concern | Being You – Always` },
        { name: "description", content: d },
        { property: "og:title", content: `${n} | Being You – Always` },
        { property: "og:description", content: d },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="container-lux py-24 text-center"><h1 className="text-4xl">Concern not found</h1><Link to="/shop" className="mt-4 inline-block text-primary underline">Shop all</Link></div>
  ),
  component: Page,
});

function Page() {
  const { concern, products } = Route.useLoaderData();
  return <CollectionView eyebrow="Shop by concern" title={concern.name} intro={concern.blurb} products={products} activeConcern={concern.slug} />;
}
