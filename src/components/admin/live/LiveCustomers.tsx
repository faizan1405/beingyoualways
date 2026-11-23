import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminPage, Panel, Table, Td, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { inrPaise } from "@/lib/format";
import { adminCommerce } from "@/services/adminCommerceService";
import { LiveState, StatusPill, TestTag, istDate, useLive } from "./shared";

/** Customers created from real orders. Spend counts verified paid, non-test orders only. */
export function LiveCustomers() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => { const t = setTimeout(() => setQuery(q), 300); return () => clearTimeout(t); }, [q]);
  const { data, error, loading, reload } = useLive(() => adminCommerce.customers({ q: query, status }), [query, status]);
  return (
    <AdminPage title="Customers" subtitle="People who placed real orders. Personal details are visible only to signed-in staff with permission.">
      <Panel>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <input aria-label="Search customers" placeholder="Name, phone or email" className={`${adminInput} sm:col-span-2`} value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Status" className={adminInput} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option><option value="ACTIVE">Active</option><option value="BLOCKED">Blocked</option></select>
        </div>
        <LiveState error={error} loading={loading && !data} onRetry={() => void reload()} />
        {data && data.customers.length > 0 && (
          <Table head={["Customer", "Phone", "Orders", "Paid spend", "COD to collect", "Last order", "Status"]}>
            {data.customers.map((c) => (
              <tr key={c.id}>
                <Td><Link to="/admin/customers/$id" params={{ id: c.id }} className="font-semibold text-primary hover:underline">{c.name}</Link><div className="text-xs text-muted-foreground">{c.email}</div></Td>
                <Td>{c.phone}</Td><Td>{c.orderCount}</Td><Td>{inrPaise(c.paidSpendPaise)}</Td><Td>{c.codOutstandingPaise ? inrPaise(c.codOutstandingPaise) : "—"}</Td>
                <Td>{c.lastOrderAt ? istDate(c.lastOrderAt) : "—"}</Td><Td>{c.status === "BLOCKED" ? <span className="text-destructive">Blocked</span> : "Active"}</Td>
              </tr>
            ))}
          </Table>
        )}
        {data && data.customers.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{query || status ? "No customers match." : "No customers yet. They appear here when someone places an order."}</p>}
      </Panel>
    </AdminPage>
  );
}

export function LiveCustomerDetail({ id }: { id: string }) {
  const { data: c, setData, error, loading, reload } = useLive(() => adminCommerce.customer(id), [id]);
  const [notes, setNotes] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!c) return <AdminPage title="Customer"><LiveState error={error ?? (loading ? null : "Customer not found.")} loading={loading} onRetry={() => void reload()} /></AdminPage>;
  const save = async (b: { notes?: string; status?: "ACTIVE" | "BLOCKED" }, ok: string) => {
    setBusy(true);
    try { setData(await adminCommerce.updateCustomer(c.id, b)); setNotes(null); toast(ok); } catch (e) { toast.error(e instanceof Error ? e.message : "Not saved."); } finally { setBusy(false); }
  };
  return (
    <AdminPage title={c.name} subtitle={`Customer since ${istDate(c.createdAt)}`}>
      <Link to="/admin/customers" className="text-sm text-muted-foreground hover:underline">← All customers</Link>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel title={`Orders (${c.orders.length})`}>
          {c.orders.length === 0 ? <p className="text-sm text-muted-foreground">No orders.</p> : (
            <Table head={["Order", "Date", "Payment", "Status", "Total"]}>
              {c.orders.map((o) => <tr key={o.id}><Td><Link to="/admin/orders/$id" params={{ id: o.id }} className="font-semibold text-primary hover:underline">{o.orderNumber}</Link>{o.isTest && <TestTag />}</Td><Td>{istDate(o.createdAt)}</Td><Td><StatusPill kind="payment" value={o.paymentStatus} /></Td><Td><StatusPill kind="order" value={o.status} /></Td><Td>{inrPaise(o.totalPaise)}</Td></tr>)}
            </Table>
          )}
        </Panel>
        <div className="space-y-6">
          <Panel title="Details">
            <p className="text-sm">{c.phone}<br />{c.email ?? "No email"}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className={adminLabel}>Orders</dt><dd>{c.orderCount}</dd></div>
              <div><dt className={adminLabel}>Paid spend</dt><dd>{inrPaise(c.paidSpendPaise)}</dd></div>
              <div><dt className={adminLabel}>COD to collect</dt><dd>{inrPaise(c.codOutstandingPaise)}</dd></div>
              <div><dt className={adminLabel}>Status</dt><dd>{c.status === "BLOCKED" ? "Blocked" : "Active"}</dd></div>
            </dl>
            <Button className="mt-4" variant="outline" disabled={busy} onClick={() => void save({ status: c.status === "BLOCKED" ? "ACTIVE" : "BLOCKED" }, c.status === "BLOCKED" ? "Customer unblocked" : "Customer blocked")}>
              {c.status === "BLOCKED" ? "Unblock customer" : "Block from ordering"}
            </Button>
          </Panel>
          <Panel title="Internal notes">
            <label htmlFor="cnotes" className="sr-only">Notes</label>
            <textarea id="cnotes" rows={4} className={`${adminInput} h-auto py-2`} value={notes ?? c.notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} />
            <Button className="mt-3" variant="lux" disabled={busy || notes == null} onClick={() => void save({ notes: notes ?? "" }, "Notes saved")}>Save notes</Button>
          </Panel>
          <Panel title="Addresses">
            <ul className="space-y-3 text-sm">{c.addresses.map((a) => <li key={a.id} className="leading-relaxed"><span className="text-xs uppercase text-muted-foreground">{a.label}</span><br />{a.line1}{a.line2 && `, ${a.line2}`}<br />{a.city}, {a.state} – {a.pincode}</li>)}</ul>
          </Panel>
        </div>
      </div>
    </AdminPage>
  );
}
