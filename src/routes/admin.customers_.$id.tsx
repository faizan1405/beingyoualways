import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminPage, NotConnected, Panel, Table, Td, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { OrderStatusBadge } from "@/components/shop/OrderBadges";
import { Button } from "@/components/ui/button";
import { useDemoStore } from "@/hooks/use-demo-store";
import { inr, shortDate } from "@/lib/format";
import type { Customer } from "@/lib/types";
import { customerService, customerStore, withStats } from "@/services/customerService";
import { orderStore } from "@/services/orderService";

export const Route = createFileRoute("/admin/customers_/$id")({ component: CustomerAdmin });

function CustomerAdmin() {
  const { id } = Route.useParams();
  const allOrders = useDemoStore(orderStore);
  const raw = useDemoStore(customerStore).find((x) => x.id === id);
  const [notes, setNotes] = useState("");
  useEffect(() => { setNotes(raw?.notes ?? ""); }, [raw?.notes]);
  if (!raw) return <p>Customer not found. <Link to="/admin/customers" className="underline">Back</Link></p>;
  const c = withStats(raw, allOrders);
  const orders = allOrders.filter((o) => o.customerId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const setStatus = async (status: Customer["status"]) => {
    if (status === "blocked" && !window.confirm(`Block ${c.name}? (Demo — this only changes the label here.)`)) return;
    await customerService.update(c.id, { status });
    toast(`Account marked ${status} (demo)`);
  };

  return (
    <AdminPage title={c.name} subtitle={`Demo customer · joined ${shortDate(c.joinedAt)}`}>
      <div className="grid gap-4 lg:grid-cols-[340px_1fr] [&>*]:min-w-0">
        <div className="space-y-4">
          <Panel title="Profile">
            <dl className="space-y-2 text-sm">
              {[["Email", c.email], ["Phone", c.phone], ["Segment", c.segment], ["Total orders", String(c.orderCount)], ["Total spending", inr(c.totalSpent)]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="text-right">{v}</dd></div>
              ))}
            </dl>
            <p className="mt-2 text-[11px] text-muted-foreground">Totals are worked out from this customer's demo orders (cancelled and returned orders don't count as spending).</p>
            <label htmlFor="cs" className={`${adminLabel} mt-4`}>Account status</label>
            <select id="cs" className={adminInput} value={c.status} onChange={(e) => setStatus(e.target.value as Customer["status"])}><option value="active">Active</option><option value="blocked">Blocked</option></select>
          </Panel>
          <Panel title="Saved addresses (demo)">
            <ul className="space-y-3 text-sm">
              {c.addresses.map((a) => <li key={a.id} className="rounded-md bg-secondary/60 p-3"><p className="font-semibold">{a.label}{a.isDefault ? " · default" : ""}</p><p className="text-muted-foreground">{a.line1}, {a.city}, {a.state} {a.pincode}</p></li>)}
            </ul>
          </Panel>
          <Panel title="Sign-in">
            <p className="text-sm">Method: {c.signInMethod ? (c.signInMethod === "google" ? "Google" : "WhatsApp OTP") : "None yet"}</p>
            <div className="mt-3 flex flex-wrap gap-2"><NotConnected label="Google sign-in not connected" /><NotConnected label="WhatsApp OTP not connected" /></div>
          </Panel>
          <Panel title="WhatsApp marketing consent">
            <label htmlFor="wc" className={adminLabel}>Consent</label>
            <select id="wc" className={adminInput} value={c.whatsappOptIn ?? ""} onChange={async (e) => { const v = e.target.value; await customerService.update(c.id, { whatsappOptIn: v === "opted-in" || v === "opted-out" ? v : undefined }); toast("Consent updated (demo)"); }}>
              <option value="">Not asked — no marketing messages</option>
              <option value="opted-in">Opted in (customer agreed)</option>
              <option value="opted-out">Opted out / replied STOP</option>
            </select>
            <p className="mt-2 text-xs text-muted-foreground">Only record consent the customer actually gave. Order updates and sign-in codes don't need marketing consent; campaigns and cart reminders do.</p>
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Order history">
            {orders.length === 0 ? <p className="py-6 text-sm text-muted-foreground">No orders yet.</p> : (
              <Table head={["Order", "Date", "Items", "Status", "Total"]}>
                {orders.map((o) => (
                  <tr key={o.id}><Td><Link to="/admin/orders/$id" params={{ id: o.id }} className="text-primary hover:underline">{o.id}</Link></Td><Td>{shortDate(o.createdAt)}</Td><Td>{o.items.reduce((s, i) => s + i.quantity, 0)}</Td><Td><OrderStatusBadge status={o.status} /></Td><Td>{inr(o.total)}</Td></tr>
                ))}
              </Table>
            )}
          </Panel>
          <Panel title="Customer notes (team only)">
            <label htmlFor="cn" className="sr-only">Notes</label>
            <textarea id="cn" rows={4} maxLength={1000} className={`${adminInput} h-auto py-2`} placeholder="e.g. Prefers calls after 5pm" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-[11px] text-muted-foreground">Kept for this browser tab only — don't type sensitive personal details.</p>
              <Button variant="outline" disabled={notes === c.notes} onClick={async () => { await customerService.update(c.id, { notes: notes.trim() }); toast("Notes saved (demo)"); }}>Save notes</Button>
            </div>
          </Panel>
        </div>
      </div>
    </AdminPage>
  );
}
