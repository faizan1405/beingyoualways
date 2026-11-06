import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useShop } from "@/lib/shop-store";
import { productService } from "@/services/productService";
import { ProductCard } from "./ProductCard";

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
