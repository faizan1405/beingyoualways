import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, CloudOff, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";

import { CartLines } from "@/components/site/CartLines";
import { OrderTotals } from "@/components/site/OrderTotals";
import { DemoNotice } from "@/components/shop/DemoNotice";
import { Button } from "@/components/ui/button";
import { inr, inrPaise } from "@/lib/format";
import { useShop } from "@/lib/shop-store";
import { isBackendConfigured } from "@/services/api";
import { shopService, summaryFromServer, type Quote } from "@/services/shopService";
import { whatsappShop } from "@/services/whatsappLiveService";
import { toast } from "sonner";

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
  validateSearch: (s: Record<string, unknown>): { recover?: string | undefined } =>
    typeof s["recover"] === "string" && /^[A-Za-z0-9_-]{20,80}$/.test(s["recover"]) ? { recover: s["recover"] } : {},
  component: CartPage,
});

/** Opening the WhatsApp reminder link puts the remembered products back in the bag (current prices apply). */
function useRecoverBag() {
  const { recover } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { add, qtyInBag } = useShop();
  useEffect(() => {
    if (!recover || !isBackendConfigured()) return;
    let done = false;
    whatsappShop.recoverBag(recover)
      .then((r) => {
        if (done) return;
        let added = 0;
        for (const l of r.lines) { const need = l.quantity - qtyInBag(l.productId, l.variantId); if (need > 0 && add(l.productId, l.variantId, need, { openDrawer: false }).ok) added++; }
        toast(added ? "Your bag is back — prices are checked again before you pay." : "Your bag already has these products.");
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "This bag link has expired."))
      .finally(() => { if (!done) void navigate({ search: {}, replace: true }); });
    return () => { done = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recover]);
}

/** Live shop: the store server re-checks every line (availability, stock, current price). */
function useBagCheck() {
  const { lines } = useShop();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const key = JSON.stringify(lines.map((l) => [l.productId, l.variantId, l.quantity, l.variant.price]));
  useEffect(() => {
    if (!isBackendConfigured() || lines.length === 0) return;
    let stale = false;
    const t = setTimeout(() => {
      shopService.quote({ lines: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity, seenUnitPrice: l.variant.price })) })
        .then((q) => { if (!stale) { setQuote(q); setOffline(null); } })
        .catch((e) => { if (!stale) setOffline(e instanceof Error ? e.message : "Can't reach the store right now."); });
    }, 250);
    return () => { stale = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { quote, offline };
}

function CartPage() {
  const { lines, count, summary } = useShop();
  const live = isBackendConfigured();
  const { quote, offline } = useBagCheck();
  useRecoverBag();
  const issues = (quote?.lines ?? []).filter((l) => l.status !== "ok" || l.priceChanged);
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
            {live && (offline || issues.length > 0) && (
              <div role="alert" className="mb-5 space-y-1.5 rounded-md border border-destructive/40 bg-background p-3 text-xs leading-relaxed">
                {offline && <p className="flex gap-1.5"><CloudOff className="size-3.5 shrink-0" /> {offline}</p>}
                {issues.map((l) => (
                  <p key={l.variantId} className="flex gap-1.5"><AlertTriangle className="size-3.5 shrink-0 text-destructive" />
                    {l.status !== "ok" ? l.message : `The price of ${l.name} is now ${inrPaise(l.priceChanged!.toPaise)} (was ${inrPaise(l.priceChanged!.fromPaise)}).`}</p>
                ))}
              </div>
            )}
            <OrderTotals summary={live && quote?.totals ? summaryFromServer(quote.totals, summary.itemCount) : undefined} />
            {live && quote && !quote.shipping.configured && <p className="mt-3 text-xs text-muted-foreground">Ordering is paused while the store finishes setting up delivery charges.</p>}
            <Button variant="lux" size="xl" className="mt-6 w-full" asChild><Link to="/checkout">Proceed to checkout <ArrowRight /></Link></Button>
            <Button variant="link" className="mt-2 w-full" asChild><Link to="/shop">Continue shopping</Link></Button>
            {!live && <DemoNotice className="mt-4 text-xs">Development preview — your bag is saved in this browser only, and orders can't be placed until the shop is connected to the store server.</DemoNotice>}
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
