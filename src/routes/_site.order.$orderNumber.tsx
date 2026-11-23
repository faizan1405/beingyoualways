import { Link, createFileRoute, useLocation } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock, CloudOff, Loader2, Package, Truck, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { inrPaise } from "@/lib/format";
import { recalledOrderToken, rememberOrderLink, tokenFromHash } from "@/lib/order-links";
import { openRazorpay } from "@/lib/razorpay-checkout";
import { useShop } from "@/lib/shop-store";
import { clearCheckoutDraft, resetCheckoutKey } from "@/lib/checkout-draft";
import { isBackendConfigured } from "@/services/api";
import { PAYMENT_STATUS_LABEL, shopService, type OrderResult } from "@/services/shopService";

export const Route = createFileRoute("/_site/order/$orderNumber")({
  head: ({ params }) => ({
    meta: [
      { title: `Order ${params.orderNumber} | Being You – Always` },
      { name: "description", content: "Your Being You – Always order status, payment and delivery details." },
      { property: "og:title", content: "Your order | Being You – Always" },
      { property: "og:description", content: "Order status for your Being You – Always purchase." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OrderPage,
});

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

function OrderPage() {
  const { orderNumber } = Route.useParams();
  const { hash } = useLocation();
  const { clear } = useShop();
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<OrderResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    // The server never sees the part after "#", so read it from the browser as well as the router.
    const t = tokenFromHash(hash) ?? tokenFromHash(window.location.hash) ?? recalledOrderToken(orderNumber);
    if (t) rememberOrderLink(orderNumber, t);
    setToken(t);
    if (!t) setProblem("This order link is incomplete. Open the link from your order confirmation, or contact the store with your order number.");
  }, [hash, orderNumber]);

  // `clear` gets a new identity whenever the bag changes; keep it in a ref so emptying the bag
  // never re-triggers the look-up (that loop would hammer the store server).
  const clearRef = useRef(clear);
  clearRef.current = clear;
  const cleared = useRef(false);
  const load = useCallback(async () => {
    if (!token) return;
    try {
      const r = await shopService.lookup({ orderNumber, token });
      setData(r); setProblem(null);
      if (!cleared.current && (r.order.paymentStatus === "PAID" || r.order.paymentStatus === "COD_PENDING")) {
        cleared.current = true;
        clearRef.current(); clearCheckoutDraft(); resetCheckoutKey();
      }
    } catch (e) { setProblem(e instanceof Error ? e.message : "Can't reach the store right now."); }
  }, [orderNumber, token]);
  useEffect(() => { void load(); }, [load]);

  // While an online payment is being confirmed, check again every few seconds (webhooks can arrive a little later).
  const pending = data?.order.status === "PENDING_PAYMENT";
  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => void load(), 8_000);
    return () => clearInterval(id);
  }, [pending, load]);

  const pay = async () => {
    if (!token || !data) return;
    setPaying(true);
    const access = { orderNumber, token };
    try {
      const r = await shopService.retryPayment(access);
      if (!r.payment) { setData(r); return; }
      const out = await openRazorpay(r.payment, { name: "Being You – Always", color: "#263B31" });
      if (out.kind === "success") setData(await shopService.verifyRazorpay(access, out.result));
      else {
        setData(await shopService.reportProblem(access, out.kind === "failed" ? { kind: "failed", reason: out.reason, ...(out.paymentId ? { razorpay_payment_id: out.paymentId } : {}) } : { kind: "cancelled" }));
        toast(out.kind === "failed" ? "The payment didn't go through. You can try again." : "Payment window closed. Nothing was charged.");
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't open the payment window."); }
    finally { setPaying(false); }
  };

  if (!isBackendConfigured())
    return <Shell><CloudOff className="mx-auto size-10 text-muted-foreground" /><h1 className="mt-5 text-4xl">Orders aren't connected here</h1><p className="mt-3 text-muted-foreground">This development preview isn't connected to the store server, so there are no real orders to show.</p></Shell>;
  if (problem && !data)
    return <Shell><AlertTriangle className="mx-auto size-10 text-destructive" /><h1 className="mt-5 text-4xl">We couldn't open this order</h1><p className="mt-3 text-muted-foreground">{problem}</p>{token && <Button className="mt-6" variant="lux" onClick={() => void load()}>Try again</Button>}</Shell>;
  if (!data) return <Shell><Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" /><p className="mt-4 text-sm text-muted-foreground">Loading your order…</p></Shell>;

  const o = data.order;
  const t = o.totals;
  const head =
    o.status === "CANCELLED" ? { I: XCircle, cls: "text-destructive", title: "This order was cancelled", text: o.paymentStatus === "PAID" ? "Your payment will be refunded by the store." : "Nothing was charged." }
    : o.status === "PENDING_PAYMENT" ? { I: Clock, cls: "text-accent", title: "Waiting for your payment", text: `Your order is saved and the items are held for you${o.payBy ? ` until ${fmt(o.payBy)}` : ""}. It is confirmed once the payment is verified.` }
    : o.paymentMethod === "cod" && o.paymentStatus === "COD_PENDING" ? { I: CheckCircle2, cls: "text-success", title: "Thank you — your order is placed", text: `Please keep ${inrPaise(t.totalPaise)} ready to pay in cash on delivery.` }
    : { I: CheckCircle2, cls: "text-success", title: o.paymentStatus === "PAID" ? "Thank you — payment received" : "Your order", text: "We'll pack your order with care." };

  return (
    <div className="container-lux max-w-3xl py-14 md:py-20">
      <div className="text-center">
        <head.I className={`mx-auto size-12 ${head.cls}`} strokeWidth={1.3} />
        <h1 className="mt-5 text-4xl md:text-5xl">{head.title}</h1>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">{head.text}</p>
        <p className="mt-4 text-sm">Order number <strong className="font-semibold tracking-wide">{o.orderNumber}</strong> · {fmt(o.createdAt)}</p>
        {o.isTest && <p className="mx-auto mt-3 w-fit rounded-full border border-accent/50 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">Test order — not a real sale</p>}
        {pending && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <Button variant="lux" size="xl" onClick={() => void pay()} disabled={paying}>{paying ? <><Loader2 className="animate-spin" /> Opening Razorpay…</> : <>Complete payment · {inrPaise(t.totalPaise)}</>}</Button>
            <p className="text-xs text-muted-foreground">Already paid? This page updates automatically once Razorpay confirms it.</p>
          </div>
        )}
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        <Info title="Order status" I={Package}>{o.statusLabel}</Info>
        <Info title="Payment" I={CheckCircle2}>{PAYMENT_STATUS_LABEL[o.paymentStatus]}</Info>
        <Info title="Delivering to" I={Truck}>{o.shipTo.name}<br />{o.shipTo.city}, {o.shipTo.state} – {o.shipTo.pincode}</Info>
      </div>
      {o.shipment && (
        <p className="mt-5 rounded-xl border border-border p-4 text-sm">Shipped with <strong>{o.shipment.carrier}</strong> · tracking number <strong>{o.shipment.trackingNumber}</strong>
          {o.shipment.trackingUrl && <> · <a href={o.shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="underline">Track parcel</a></>}</p>
      )}

      <section className="mt-8 rounded-xl border border-border p-5 sm:p-6">
        <h2 className="text-2xl">Items</h2>
        <ul className="mt-4 divide-y divide-border text-sm">
          {o.items.map((i) => (
            <li key={`${i.variantId}-${i.name}`} className="flex justify-between gap-4 py-3">
              <span className="min-w-0"><span className="block">{i.name}</span><span className="text-xs text-muted-foreground">{i.variantLabel} · {inrPaise(i.unitPaise)} × {i.quantity}</span></span>
              <span className="shrink-0 tabular-nums">{inrPaise(i.lineTotalPaise)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          <Row k="Subtotal" v={inrPaise(t.subtotalPaise)} />
          {t.discountPaise > 0 && <Row k={`Discount${o.discountCode ? ` (${o.discountCode})` : ""}`} v={`−${inrPaise(t.discountPaise)}`} />}
          <Row k="Shipping" v={t.shippingPaise === 0 ? "Free" : inrPaise(t.shippingPaise)} />
          {t.codFeePaise > 0 && <Row k="Cash on Delivery charge" v={inrPaise(t.codFeePaise)} />}
          <div className="flex justify-between border-t border-border pt-3 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{inrPaise(t.totalPaise)}</dd></div>
        </dl>
      </section>
      <p className="mt-6 text-center text-xs text-muted-foreground">Keep this page's address to check your order again. It's private to you — please don't share it.</p>
      <div className="mt-6 flex justify-center"><Button variant="luxOutline" size="xl" asChild><Link to="/shop">Continue shopping</Link></Button></div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="container-lux max-w-xl py-24 text-center">{children}<div className="mt-8"><Button variant="luxOutline" asChild><Link to="/shop">Continue shopping</Link></Button></div></div>;
}
function Info({ title, I, children }: { title: string; I: typeof Package; children: React.ReactNode }) {
  return <div className="rounded-xl border border-border p-4 text-sm"><p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><I className="size-3.5" /> {title}</p><p className="mt-2">{children}</p></div>;
}
const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between gap-4"><dt>{k}</dt><dd className="tabular-nums">{v}</dd></div>;
