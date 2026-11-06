import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { inr } from "@/lib/format";
import { useShop } from "@/lib/shop-store";
import { FREE_SHIPPING_THRESHOLD } from "@/services/cartService";
import { CartLines } from "./CartLines";

export function CartDrawer() {
  const { drawerOpen, setDrawerOpen, lines, subtotal, count } = useShop();
  const remaining = FREE_SHIPPING_THRESHOLD - subtotal;
  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetContent side="right" className="flex w-full flex-col bg-background p-0 sm:max-w-md">
        <div className="border-b border-border px-6 py-5">
          <SheetTitle className="font-serif text-2xl">Your Bag ({count})</SheetTitle>
          {count > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {remaining > 0 ? `Add ${inr(remaining)} more for free shipping` : "You've unlocked free shipping"}
            </p>
          )}
        </div>
        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <ShoppingBag className="size-10 text-muted-foreground" strokeWidth={1.2} />
            <p className="font-serif text-2xl">Your bag is empty</p>
            <Button variant="lux" size="xl" asChild onClick={() => setDrawerOpen(false)}><Link to="/shop">Shop the collection</Link></Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6"><CartLines compact /></div>
            <div className="space-y-3 border-t border-border px-6 py-5">
              <div className="flex justify-between text-sm"><span>Subtotal</span><span className="font-semibold">{inr(subtotal)}</span></div>
              <Button variant="lux" size="xl" className="w-full" asChild onClick={() => setDrawerOpen(false)}><Link to="/checkout">Proceed to checkout</Link></Button>
              <Button variant="luxOutline" size="xl" className="w-full" asChild onClick={() => setDrawerOpen(false)}><Link to="/cart">View bag</Link></Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
