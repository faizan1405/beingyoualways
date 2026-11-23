import { Link, createFileRoute } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminPage, Panel, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { OrderStatusBadge, PaymentBadge } from "@/components/shop/OrderBadges";
import { Button } from "@/components/ui/button";
import { useDemoStore } from "@/hooks/use-demo-store";
import { inr, shortDate } from "@/lib/format";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/types";
import { orderService, orderStore } from "@/services/orderService";

export const Route = createFileRoute("/admin/orders_/$id")({ component: OrderAdmin });

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

function OrderAdmin() {
  const { id } = Route.useParams();
  const o = useDemoStore(orderStore).find((x) => x.id === id);
  const [note, setNote] = useState("");
  if (!o) return <p>Order not found. <Link to="/admin/orders" className="underline">Back to orders</Link></p>;

  const setStatus = async (s: OrderStatus) => {
    if (s === o.status) return;
    if ((s === "cancelled" || s === "returned") && !window.confirm(`Mark ${o.id} as ${s}? It will no longer count towards sales.`)) return;
    await orderService.updateStatus(o.id, s);
    toast(`Status set to ${s} (demo — customer not notified)`);
  };
  const a = o.shippingAddress;

  return (
    <AdminPage title={`Order ${o.id}`} subtitle={`${when(o.createdAt)} · demo order — not a real purchase`}
      actions={<Button variant="luxOutline" size="xl" onClick={() => window.print()}><Printer /> Print summary</Button>}>
      <div className="grid gap-4 xl:grid-cols-[1fr_340px] [&>*]:min-w-0" data-print-area>
        <div className="space-y-4">
          <Panel title="Products purchased">
            <ul className="divide-y divide-border text-sm">
              {o.items.map((i) => <li key={i.variantId} className="flex justify-between gap-4 py-3"><span>{i.name} <span className="text-muted-foreground">· {i.variantLabel} × {i.quantity}</span></span><span className="tabular-nums">{inr(i.price * i.quantity)}</span></li>)}
            </ul>
            <dl className="ml-auto mt-4 max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{inr(o.subtotal)}</dd></div>
              <div className="flex justify-between"><dt>Discount{o.discountCode ? ` (${o.discountCode})` : ""}</dt><dd>{o.discount ? `− ${inr(o.discount)}` : "—"}</dd></div>
              <div className="flex justify-between"><dt>Shipping</dt><dd>{o.shipping == null ? <span className="text-muted-foreground">Pending confirmation</span> : o.shipping === 0 ? "Free" : inr(o.shipping)}</dd></div>
              <div className="flex justify-between border-t border-border pt-1 font-semibold"><dt>Final amount{o.shipping == null ? " (before shipping)" : ""}</dt><dd>{inr(o.total)}</dd></div>
            </dl>
          </Panel>
          <Panel title="Timeline">
            <ol className="relative space-y-3 border-l border-border pl-5 text-sm">
              {[...o.timeline].reverse().map((t, i) => (
                <li key={`${t.at}-${i}`}><span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-primary" aria-hidden /><p>{t.label}</p><p className="text-xs text-muted-foreground">{when(t.at)}</p></li>
              ))}
            </ol>
          </Panel>
          <Panel title="Internal notes">
            {o.notes.length === 0 ? <p className="text-sm text-muted-foreground">No notes yet. Notes are for the team only.</p> : (
              <ul className="space-y-2 text-sm">{o.notes.map((n) => <li key={n.id} className="rounded-md bg-secondary/60 p-3"><p className="whitespace-pre-line">{n.text}</p><p className="mt-1 text-xs text-muted-foreground">{when(n.at)}</p></li>)}</ul>
            )}
            <form className="mt-3 flex flex-col gap-2 sm:flex-row" data-print-hide onSubmit={async (e) => { e.preventDefault(); try { await orderService.addNote(o.id, note); setNote(""); toast("Note added"); } catch (err) { toast.error((err as Error).message); } }}>
              <label htmlFor="on" className="sr-only">New note</label>
              <textarea id="on" rows={2} maxLength={500} placeholder="e.g. Customer asked to deliver after 6pm" className={`${adminInput} h-auto py-2`} value={note} onChange={(e) => setNote(e.target.value)} />
              <Button type="submit" variant="outline" disabled={!note.trim()}>Add note</Button>
            </form>
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Status">
            <div className="mb-4 flex flex-wrap gap-2"><OrderStatusBadge status={o.status} /><PaymentBadge status={o.paymentStatus} /><span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold">Demo</span></div>
            <label htmlFor="os" className={adminLabel}>Update order status</label>
            <select id="os" className={`${adminInput} capitalize`} value={o.status} onChange={(e) => setStatus(e.target.value as OrderStatus)} data-print-hide>
              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <dl className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Payment method</dt><dd>{o.paymentMethod === "cod" ? "Cash on Delivery" : "Razorpay"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Payment status</dt><dd className="capitalize">{o.paymentStatus === "cod" ? "Pay on delivery" : o.paymentStatus}{o.paymentStatus === "paid" ? " (simulated)" : ""}</dd></div>
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">Payments aren't connected, so payment status can't be changed here.</p>
          </Panel>
          <Panel title="Customer">
            <p className="text-sm font-semibold">{o.customerName}</p>
            <p className="text-sm text-muted-foreground">{o.customerPhone}<br />{o.customerEmail}</p>
            <p className={`${adminLabel} mt-4`}>Delivery address</p>
            <address className="text-sm not-italic text-muted-foreground">{a.name}<br />{a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />{a.city}, {a.state} {a.pincode}</address>
            <Link to="/admin/customers/$id" params={{ id: o.customerId }} className="mt-3 inline-block text-xs text-primary hover:underline" data-print-hide>View customer →</Link>
          </Panel>
          <p className="text-xs text-muted-foreground">Ordered {shortDate(o.createdAt)}</p>
        </div>
      </div>
    </AdminPage>
  );
}
