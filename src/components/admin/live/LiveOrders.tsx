import { Link } from "@tanstack/react-router";
import { Download, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminPage, Panel, Table, Td, adminInput } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { inrPaise } from "@/lib/format";
import { adminCommerce, type OrderFilters } from "@/services/adminCommerceService";
import { LiveState, ORDER_STATUS_TEXT, PAYMENT_STATUS_TEXT, StatusPill, TestTag, istDate, useLive } from "./shared";

/** Real customer orders from MySQL with search, filters, paging and CSV export. */
export function LiveOrders() {
  const [f, setF] = useState<OrderFilters>({ page: 1 });
  const [q, setQ] = useState("");
  useEffect(() => { const t = setTimeout(() => setF((p) => ({ ...p, q, page: 1 })), 300); return () => clearTimeout(t); }, [q]);
  const { data, error, loading, reload } = useLive(() => adminCommerce.orders(f), [JSON.stringify(f)]);
  const set = <K extends keyof OrderFilters>(k: K, v: OrderFilters[K]) => setF((p) => ({ ...p, [k]: v, page: 1 }));
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AdminPage title="Orders" subtitle="Real orders from the store database. Payment status changes only through verified Razorpay payments or recorded COD cash."
      actions={<div className="flex flex-wrap gap-2">
        <Button variant="luxOutline" size="xl" onClick={() => adminCommerce.reconcile().then((r) => { toast(`Checked ${r.checked} unpaid online order(s): ${r.paid} confirmed paid, ${r.expired} expired.`); void reload(); }).catch((e) => toast.error(e.message))}><RefreshCw /> Check payments</Button>
        <Button variant="luxOutline" size="xl" disabled={!data?.total} onClick={() => adminCommerce.exportOrders(f).catch((e) => toast.error(e.message))}><Download /> Export CSV</Button>
      </div>}>
      <Panel>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <input aria-label="Search orders" placeholder="Order number, name, phone or email" className={`${adminInput} xl:col-span-2`} value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Order status" className={adminInput} value={f.status ?? ""} onChange={(e) => set("status", e.target.value as OrderFilters["status"])}>
            <option value="">All statuses</option>{Object.entries(ORDER_STATUS_TEXT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select aria-label="Payment status" className={adminInput} value={f.paymentStatus ?? ""} onChange={(e) => set("paymentStatus", e.target.value as OrderFilters["paymentStatus"])}>
            <option value="">All payments</option>{Object.entries(PAYMENT_STATUS_TEXT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <input type="date" aria-label="From date" className={adminInput} value={f.from ?? ""} onChange={(e) => set("from", e.target.value || undefined)} />
          <input type="date" aria-label="To date" className={adminInput} value={f.to ?? ""} onChange={(e) => set("to", e.target.value || undefined)} />
          <select aria-label="Payment method" className={adminInput} value={f.method ?? ""} onChange={(e) => set("method", e.target.value as OrderFilters["method"])}>
            <option value="">All methods</option><option value="COD">Cash on Delivery</option><option value="RAZORPAY">Razorpay</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={!!f.includeTest} onChange={(e) => set("includeTest", e.target.checked)} /> Show test orders</label>
        </div>
        <LiveState error={error} loading={loading && !data} onRetry={() => void reload()} />
        {data && data.orders.length > 0 && (
          <Table head={["Order", "Date", "Customer", "Items", "Payment", "Status", "Total"]}>
            {data.orders.map((o) => (
              <tr key={o.id}>
                <Td><Link to="/admin/orders/$id" params={{ id: o.id }} className="font-semibold text-primary hover:underline">{o.orderNumber}</Link>{o.isTest && <TestTag />}</Td>
                <Td>{istDate(o.createdAt)}</Td>
                <Td>{o.customerName}<div className="text-xs text-muted-foreground">{o.phone} · {o.city}</div></Td>
                <Td>{o.itemCount}</Td>
                <Td><StatusPill kind="payment" value={o.paymentStatus} /><div className="mt-1 text-[11px] text-muted-foreground">{o.paymentMethod === "COD" ? "COD" : "Razorpay"}</div></Td>
                <Td><StatusPill kind="order" value={o.status} /></Td>
                <Td className="tabular-nums">{inrPaise(o.totals.totalPaise)}</Td>
              </tr>
            ))}
          </Table>
        )}
        {data && data.orders.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{data.total === 0 && !f.q && !f.status && !f.paymentStatus ? "No orders yet. Orders appear here as soon as customers place them." : "No orders match these filters."}</p>}
        {data && pages > 1 && (
          <div className="mt-4 flex items-center justify-end gap-3 text-sm">
            <Button variant="outline" size="sm" disabled={(f.page ?? 1) <= 1} onClick={() => setF((p) => ({ ...p, page: (p.page ?? 1) - 1 }))}>Previous</Button>
            <span>Page {f.page ?? 1} of {pages} · {data.total} orders</span>
            <Button variant="outline" size="sm" disabled={(f.page ?? 1) >= pages} onClick={() => setF((p) => ({ ...p, page: (p.page ?? 1) + 1 }))}>Next</Button>
          </div>
        )}
      </Panel>
    </AdminPage>
  );
}
