import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, ShoppingBag } from "lucide-react";

import { CartLines } from "@/components/site/CartLines";
import { OrderTotals } from "@/components/site/OrderTotals";
import { DemoNotice } from "@/components/shop/DemoNotice";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { lines, count, summary } = useShop();
  return (
    <div className="container-lux py-10 pb-32 md:py-14 lg:pb-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-4xl sm:text-5xl md:text-6xl">Your Bag</h1>
        {count > 0 && <p className="text-sm text-muted-foreground">{count} {count === 1 ? "item" : "items"}</p>}
      </div>
      {lines.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <span className="grid size-24 place-items-center rounded-full bg-secondary"><ShoppingBag className="size-10 text-muted-foreground" strokeWidth={1.2} /></span>
          <p className="font-serif text-3xl">Your bag is empty</p>
          <p className="max-w-sm text-sm text-muted-foreground">Saved something earlier? Check your wishlist, or explore the collection.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="lux" size="xl" asChild><Link to="/shop">Continue shopping</Link></Button>
            <Button variant="luxOutline" size="xl" asChild><Link to="/wishlist">View wishlist</Link></Button>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-10 lg:mt-10 lg:grid-cols-[1fr_380px] lg:gap-12">
          <div className="min-w-0 border-t border-border"><CartLines /></div>
          <aside className="h-fit rounded-xl bg-secondary p-5 sm:p-6 lg:sticky lg:top-24">
            <h2 className="mb-5 text-2xl">Order summary</h2>
            <OrderTotals />
            <Button variant="lux" size="xl" className="mt-6 w-full" asChild><Link to="/checkout">Proceed to checkout <ArrowRight /></Link></Button>
            <Button variant="link" className="mt-2 w-full" asChild><Link to="/shop">Continue shopping</Link></Button>
            <DemoNotice className="mt-4 text-xs">Demo bag — saved in this browser only. No order is placed until online ordering is connected.</DemoNotice>
            <p className="mt-4 text-center text-[11px] text-muted-foreground">
              <Link to="/shipping-policy" className="underline">Shipping</Link> · <Link to="/refund-policy" className="underline">Refund & Returns</Link> · <Link to="/terms" className="underline">Terms</Link>
            </p>
          </aside>
        </div>
      )}
      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-border bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lift backdrop-blur lg:hidden">
          <div className="min-w-0 flex-1 text-sm"><p className="text-xs text-muted-foreground">Subtotal</p><p className="font-semibold tabular-nums">{inr(summary.subtotal)}</p></div>
          <Button variant="lux" size="xl" asChild><Link to="/checkout">Checkout <ArrowRight /></Link></Button>
        </div>
      )}
    </div>
  );
}
