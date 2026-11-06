import { createFileRoute } from "@tanstack/react-router";

import { WishlistGrid } from "@/components/shop/WishlistGrid";

export const Route = createFileRoute("/_site/wishlist")({
  head: () => ({
    meta: [
      { title: "Wishlist | Being You – Always" },
      { name: "description", content: "Your saved Being You – Always favourites." },
      { property: "og:title", content: "Wishlist | Being You – Always" },
      { property: "og:description", content: "Your saved favourites." },
    ],
  }),
  component: WishlistPage,
});

function WishlistPage() {
  return (
    <div className="container-lux py-14">
      <h1 className="mb-10 text-5xl md:text-6xl">Wishlist</h1>
      <WishlistGrid />
    </div>
  );
}
