import { Link } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { AdminPage, Panel, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { inrPaise } from "@/lib/format";
import { adminCommerce, rupeesToPaise, type AdminOrderDetail } from "@/services/adminCommerceService";
import type { OrderStatusKey } from "@/services/shopService";
import { OrderWhatsAppPanel } from "./OrderWhatsAppPanel";
import { LiveState, ORDER_STATUS_TEXT, StatusPill, TestTag, istDateTime, useLive } from "./shared";

const NEXT_LABEL: Partial<Record<OrderStatusKey, string>> = { CONFIRMED: "Confirm order", PROCESSING: "Start packing", SHIPPED: "Mark shipped", DELIVERED: "Mark delivered", RETURNED: "Mark returned" };

/** One real order: items, customer, payment records, timeline and the permitted actions. */
export function LiveOrderDetail({ id }: { id: string }) {
  const { data: o, setData, error, loading, reload } = useLive(() => adminCommerce.order(id), [id]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [ship, setShip] = useState({ carrier: "", trackingNumber: "", trackingUrl: "" });
  const [cod, setCod] = useState({ amount: "", reference: "", note: "" });
  const [restock, setRestock] = useState(true);

  const run = async (fn: () => Promise<AdminOrderDetail>, ok: string) => {
    setBusy(true);
    try { setData(await fn()); toast(ok); return true; } catch (e) { toast.error(e instanceof Error ? e.message : "Not saved."); return false; } finally { setBusy(false); }
  };
  if (!o) return <AdminPage title="Order"><LiveState error={error ?? (loading ? null : "Order not found.")} loading={loading} onRetry={() => void reload()} /><Link to="/admin/orders" className="text-sm underline">Back to orders</Link></AdminPage>;

  const t = o.totals;
  const a = o.shippingAddress;
  const submitShip = (e: FormEvent) => { e.preventDefault(); void run(() => adminCommerce.setShipment(o.id, ship), "Tracking saved"); };
  const submitCod = (e: FormEvent) => {
    e.preventDefault();
    const paise = rupeesToPaise(cod.amount);
    if (paise == null || Number.isNaN(paise)) { toast.error("Enter the amount collected."); return; }
    void run(() => adminCommerce.recordCod(o.id, { amountPaise: paise, reference: cod.reference, ...(cod.note ? { note: cod.note } : {}) }), "Cash collection recorded");
  };

  return (
    <AdminPage title={o.orderNumber} subtitle={`Placed ${istDateTime(o.createdAt)} · ${o.paymentMethod === "COD" ? "Cash on Delivery" : "Razorpay"}`}
      actions={<div className="flex flex-wrap items-center gap-2"><StatusPill kind="order" value={o.status} /><StatusPill kind="payment" value={o.paymentStatus} />{o.isTest && <TestTag />}
        <Button variant="outline" onClick={() => window.print()}><Printer /> Print</Button></div>}>
      <Link to="/admin/orders" className="text-sm text-muted-foreground underline-offset-4 hover:underline">← All orders</Link>
      {o.isTest && <p className="rounded-md border border-accent/40 bg-accent/10 px-4 py-2 text-sm">Test order — placed in Razorpay Test Mode or a test store. It is never counted as a sale.</p>}
      {o.timeline.some((e) => e.type === "stock" || /refund/i.test(e.message)) && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm">Needs attention — see the timeline below.</p>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Panel title="Items">
            <ul className="divide-y divide-border text-sm">
              {o.items.map((i) => <li key={`${i.variantId}-${i.name}`} className="flex justify-between gap-3 py-2.5"><span>{i.name}<span className="block text-xs text-muted-foreground">{i.variantLabel} · {inrPaise(i.unitPaise)} × {i.quantity}</span></span><span className="tabular-nums">{inrPaise(i.lineTotalPaise)}</span></li>)}
            </ul>
            <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{inrPaise(t.subtotalPaise)}</dd></div>
              {t.discountPaise > 0 && <div className="flex justify-between"><dt>Discount {o.discountCode && `(${o.discountCode})`}</dt><dd>−{inrPaise(t.discountPaise)}</dd></div>}
              <div className="flex justify-between"><dt>Shipping</dt><dd>{t.shippingPaise ? inrPaise(t.shippingPaise) : "Free"}</dd></div>
              {t.codFeePaise > 0 && <div className="flex justify-between"><dt>COD charge</dt><dd>{inrPaise(t.codFeePaise)}</dd></div>}
              <div className="flex justify-between border-t border-border pt-2 font-semibold"><dt>Total</dt><dd>{inrPaise(t.totalPaise)}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">Stock: {{ NONE: "not tracked", RESERVED: "held for payment", COMMITTED: "deducted", RELEASED: "hold released", RESTORED: "put back" }[o.stockState] ?? o.stockState}{o.payBy && o.status === "PENDING_PAYMENT" ? ` · hold ends ${istDateTime(o.payBy)}` : ""}</p>
          </Panel>

          <Panel title="Fulfilment">
            <div className="flex flex-wrap gap-2">
              {o.allowedNext.map((s) => (
                <Button key={s} variant={s === "RETURNED" ? "outline" : "lux"} disabled={busy} onClick={() => void run(() => adminCommerce.setStatus(o.id, s, s === "RETURNED" ? { restock } : {}), `Status: ${ORDER_STATUS_TEXT[s]}`)}>{NEXT_LABEL[s] ?? ORDER_STATUS_TEXT[s]}</Button>
              ))}
              {o.canMarkOutForDelivery && <Button variant="outline" disabled={busy} onClick={() => void run(() => adminCommerce.outForDelivery(o.id), "Marked out for delivery")}>Out for delivery today</Button>}
              {o.allowedNext.includes("RETURNED") && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} /> Put returned items back in stock</label>}
              {o.allowedNext.length === 0 && <p className="text-sm text-muted-foreground">{o.status === "PENDING_PAYMENT" ? "Waiting for the customer's online payment. It moves to New automatically once Razorpay confirms it." : "No further steps for this order."}</p>}
            </div>
            {o.paymentStatus === "COD_PENDING" && o.status === "DELIVERED" && <p className="mt-3 text-xs text-muted-foreground">Delivered, but the cash isn't recorded as collected yet.</p>}
            {o.status !== "PENDING_PAYMENT" && o.status !== "CANCELLED" && (
              <form onSubmit={submitShip} className="mt-5 grid gap-3 sm:grid-cols-3">
                <div><label className={adminLabel} htmlFor="carrier">Courier</label><input id="carrier" className={adminInput} required minLength={2} value={ship.carrier} placeholder={o.shipment.carrier ?? "e.g. Delhivery"} onChange={(e) => setShip({ ...ship, carrier: e.target.value })} /></div>
                <div><label className={adminLabel} htmlFor="awb">Tracking number</label><input id="awb" className={adminInput} required minLength={3} value={ship.trackingNumber} placeholder={o.shipment.trackingNumber ?? ""} onChange={(e) => setShip({ ...ship, trackingNumber: e.target.value })} /></div>
                <div><label className={adminLabel} htmlFor="turl">Tracking link (optional)</label><input id="turl" type="url" className={adminInput} value={ship.trackingUrl} placeholder="https://" onChange={(e) => setShip({ ...ship, trackingUrl: e.target.value })} /></div>
                <div className="sm:col-span-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">{o.shipment.trackingNumber ? `Saved: ${o.shipment.carrier} ${o.shipment.trackingNumber}` : "No tracking saved yet."}</p>
                  <Button type="submit" variant="outline" disabled={busy}>Save tracking</Button>
                </div>
              </form>
            )}
            {o.canCancel && (
              <div className="mt-5 border-t border-border pt-4">
                <label className={adminLabel} htmlFor="creason">Cancel this order</label>
                <div className="flex flex-wrap gap-2">
                  <input id="creason" className={`${adminInput} min-w-0 flex-1`} placeholder="Reason (shown in the timeline)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                  <Button variant="outline" className="border-destructive/50 text-destructive" disabled={busy || cancelReason.trim().length < 3} onClick={() => setConfirmCancel(true)}>Cancel order</Button>
                </div>
                {o.paymentStatus === "PAID" && <p className="mt-2 text-xs text-destructive">This order was paid online. Cancelling doesn't refund automatically — issue the refund from the Razorpay dashboard.</p>}
              </div>
            )}
            {o.cancelReason && <p className="mt-3 text-sm">Cancelled {o.cancelledAt && istDateTime(o.cancelledAt)}: {o.cancelReason}</p>}
          </Panel>

          <Panel title="Timeline">
            <ol className="space-y-3 text-sm">
              {o.timeline.map((e) => (
                <li key={e.id} className="border-l-2 border-border pl-3">
                  <p className={e.type === "stock" ? "text-destructive" : ""}>{e.message}</p>
                  {e.note && <p className="mt-1 whitespace-pre-wrap rounded bg-secondary px-2 py-1 text-xs">{e.note}</p>}
                  <p className="text-xs text-muted-foreground">{istDateTime(e.at)}{e.by ? ` · ${e.by}` : " · system"}</p>
                </li>
              ))}
            </ol>
            <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); void run(() => adminCommerce.addNote(o.id, note), "Note added").then((ok) => ok && setNote("")); }}>
              <label htmlFor="note" className="sr-only">Internal note</label>
              <input id="note" className={`${adminInput} min-w-0 flex-1`} placeholder="Internal note (customers never see it)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
              <Button type="submit" variant="outline" disabled={busy || !note.trim()}>Add note</Button>
            </form>
          </Panel>
        </div>

        <div className="space-y-6">
          <OrderWhatsAppPanel orderId={o.id} version={`${o.status}:${o.timeline.length}`} />
          <Panel title="Customer">
            <p className="font-medium">{a.name}</p>
            <p className="text-sm">{o.phone}{o.email && <> · {o.email}</>}</p>
            {o.customerId && <Link to="/admin/customers/$id" params={{ id: o.customerId }} className="mt-1 inline-block text-xs text-primary underline">Customer history</Link>}
            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ship to ({a.type})</h3>
            <p className="mt-1 text-sm leading-relaxed">{a.line1}{a.line2 && <><br />{a.line2}</>}<br />{a.city}, {a.state} – {a.pincode}<br />{a.phone}</p>
          </Panel>
          <Panel title="Payment records">
            <ul className="space-y-3 text-sm">
              {o.payments.map((p) => (
                <li key={p.id} className="rounded-md border border-border p-3">
                  <p className="flex justify-between gap-2"><span>{p.method === "COD" ? "Cash on Delivery" : "Razorpay"}{p.isTest && <TestTag />}</span><span className="font-medium">{p.status} · {inrPaise(p.amountPaise)}</span></p>
                  {p.providerPaymentId && <p className="text-xs text-muted-foreground">Payment {p.providerPaymentId}{p.providerMethod ? ` · ${p.providerMethod}` : ""}{p.signatureVerified ? " · signature verified" : ""}</p>}
                  {p.providerOrderId && <p className="text-xs text-muted-foreground">Razorpay order {p.providerOrderId}</p>}
                  {p.recordedBy && <p className="text-xs text-muted-foreground">Cash recorded by {p.recordedBy} · ref. {p.reference}</p>}
                  {p.failureReason && <p className="text-xs text-destructive">Last problem: {p.failureReason}</p>}
                </li>
              ))}
            </ul>
            {o.canRecordCod && (
              <form onSubmit={submitCod} className="mt-4 space-y-3 border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">Record the cash only after the courier has remitted it. This is logged under your name.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className={adminLabel} htmlFor="camt">Amount collected (₹)</label><input id="camt" inputMode="decimal" required className={adminInput} placeholder={String(t.totalPaise / 100)} value={cod.amount} onChange={(e) => setCod({ ...cod, amount: e.target.value })} /></div>
                  <div><label className={adminLabel} htmlFor="cref">Reference</label><input id="cref" required minLength={2} className={adminInput} placeholder="Remittance / receipt no." value={cod.reference} onChange={(e) => setCod({ ...cod, reference: e.target.value })} /></div>
                </div>
                <Button type="submit" variant="lux" disabled={busy}>Record cash collected</Button>
              </form>
            )}
            {o.paymentEvents.length > 0 && (
              <details className="mt-4 text-xs">
                <summary className="cursor-pointer text-muted-foreground">Payment signals ({o.paymentEvents.length})</summary>
                <ul className="mt-2 space-y-1">
                  {o.paymentEvents.map((e) => <li key={e.id}>{istDateTime(e.createdAt)} · {e.source} · {e.eventType} → {e.outcome}{e.signatureValid ? "" : " (unverified)"}</li>)}
                </ul>
              </details>
            )}
          </Panel>
        </div>
      </div>
      <ConfirmDialog open={confirmCancel} onOpenChange={setConfirmCancel} title={`Cancel ${o.orderNumber}?`} confirmLabel="Cancel order"
        description={`Items are put back in stock${o.paymentStatus === "PAID" ? ". The online payment must be refunded from the Razorpay dashboard" : ""}. This can't be undone.`}
        onConfirm={() => void run(() => adminCommerce.cancel(o.id, cancelReason.trim()), "Order cancelled")} />
    </AdminPage>
  );
}
