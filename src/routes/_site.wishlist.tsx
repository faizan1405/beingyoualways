import { Link, createFileRoute } from "@tanstack/react-router";
import { Heart } from "lucide-react";

import { ProductCard } from "@/components/shop/ProductCard";
import { Button } from "@/components/ui/button";
import { useShop } from "@/lib/shop-store";
import { productService } from "@/services/productService";

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

export function WishlistGrid() {
  const { wishlist } = useShop();
  const items = productService.peekAll().filter((p) => wishlist.includes(p.id));
  if (items.length === 0)
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <Heart className="size-10 text-muted-foreground" strokeWidth={1.2} />
        <p className="font-serif text-3xl">No favourites yet</p>
        <Button variant="lux" size="xl" asChild><Link to="/shop">Discover products</Link></Button>
      </div>
    );
  return <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">{items.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}</div>;
}

function WishlistPage() {
  return (
    <div className="container-lux py-14">
      <h1 className="mb-10 text-5xl md:text-6xl">Wishlist</h1>
      <WishlistGrid />
    </div>
  );
}
