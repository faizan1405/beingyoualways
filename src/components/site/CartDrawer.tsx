import { Link } from "@tanstack/react-router";
import { ArrowRight, ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { inr } from "@/lib/format";
import { useShop } from "@/lib/shop-store";
import { CartLines } from "./CartLines";

export function CartDrawer() {
  const { drawerOpen, setDrawerOpen, lines, summary, count } = useShop();
  const close = () => setDrawerOpen(false);
  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 bg-background p-0 sm:max-w-md">
        <div className="border-b border-border px-5 py-5 pr-14 sm:px-6">
          <SheetTitle className="font-serif text-2xl">Your Bag {count > 0 && <span className="text-muted-foreground">({count})</span>}</SheetTitle>
          <SheetDescription className="mt-1 text-xs text-muted-foreground">
            {count > 0 ? "Shipping charges are pending confirmation and will be shown before payment." : "Items you add will appear here."}
          </SheetDescription>
        </div>
        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <span className="grid size-20 place-items-center rounded-full bg-secondary"><ShoppingBag className="size-8 text-muted-foreground" strokeWidth={1.2} /></span>
            <p className="font-serif text-2xl">Your bag is empty</p>
            <p className="max-w-xs text-sm text-muted-foreground">Explore skin care, hair care and colour cosmetics made with plant-based ingredients.</p>
            <Button variant="lux" size="xl" asChild onClick={close}><Link to="/shop">Shop the collection</Link></Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6"><CartLines compact /></div>
            <div className="space-y-3 border-t border-border bg-card/60 px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
              <div className="flex items-baseline justify-between text-sm"><span>Subtotal</span><span className="text-lg font-semibold tabular-nums">{inr(summary.subtotal)}</span></div>
              <div className="flex justify-between text-xs text-muted-foreground"><span>Shipping</span><span>{summary.shipping.state === "pending" ? "Pending confirmation" : summary.shipping.state === "free" ? "Free" : inr(summary.shipping.amount)}</span></div>
              <Button variant="lux" size="xl" className="w-full" asChild onClick={close}><Link to="/checkout">Proceed to checkout <ArrowRight /></Link></Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="luxOutline" size="lg" className="w-full" onClick={close}>Continue shopping</Button>
                <Button variant="ghost" size="lg" className="w-full text-[11px] font-semibold uppercase tracking-[0.16em]" asChild onClick={close}><Link to="/cart">View full bag</Link></Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
