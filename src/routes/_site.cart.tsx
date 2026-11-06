import { Link, createFileRoute } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";

import { CartLines } from "@/components/site/CartLines";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/format";
import { useShop } from "@/lib/shop-store";

export const Route = createFileRoute("/_site/cart")({
  head: () => ({
    meta: [
      { title: "Your Bag | Being You – Always" },
      { name: "description", content: "Review the items in your Being You – Always shopping bag." },
      { property: "og:title", content: "Your Bag | Being You – Always" },
      { property: "og:description", content: "Review your shopping bag." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CartPage,
});

export function OrderTotals() {
  const { subtotal, shipping, total } = useShop();
  return (
    <dl className="space-y-3 text-sm">
      <div className="flex justify-between"><dt>Subtotal</dt><dd>{inr(subtotal)}</dd></div>
      <div className="flex justify-between"><dt>Shipping</dt><dd>{shipping === 0 ? "Free" : inr(shipping)}</dd></div>
      <div className="flex justify-between border-t border-border pt-3 text-base font-semibold"><dt>Total</dt><dd>{inr(total)}</dd></div>
    </dl>
  );
}

function CartPage() {
  const { lines, count } = useShop();
  return (
    <div className="container-lux py-14">
      <h1 className="text-5xl md:text-6xl">Your Bag</h1>
      {lines.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <ShoppingBag className="size-12 text-muted-foreground" strokeWidth={1.2} />
          <p className="font-serif text-3xl">Your bag is empty</p>
          <Button variant="lux" size="xl" asChild><Link to="/shop">Continue shopping</Link></Button>
        </div>
      ) : (
        <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_380px]">
          <div><p className="text-sm text-muted-foreground">{count} items</p><CartLines /></div>
          <aside className="h-fit rounded-xl bg-secondary p-6 lg:sticky lg:top-24">
            <h2 className="mb-5 text-2xl">Order summary</h2>
            <OrderTotals />
            <Button variant="lux" size="xl" className="mt-6 w-full" asChild><Link to="/checkout">Proceed to checkout</Link></Button>
            <Button variant="link" className="mt-2 w-full" asChild><Link to="/shop">Continue shopping</Link></Button>
          </aside>
        </div>
      )}
    </div>
  );
}
