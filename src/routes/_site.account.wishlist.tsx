import { createFileRoute } from "@tanstack/react-router";

import { WishlistGrid } from "@/components/shop/WishlistGrid";

export const Route = createFileRoute("/_site/account/wishlist")({
  component: () => (
    <div>
      <h2 className="mb-6 text-3xl">Wishlist</h2>
      <WishlistGrid />
    </div>
  ),
});
