import { Link, createFileRoute } from "@tanstack/react-router";
import { Download, Plus } from "lucide-react";
import { useState } from "react";

import { AdminPage, Panel, Table, Td, adminInput } from "@/components/admin/AdminUI";
import { NewOrderDialog } from "@/components/admin/NewOrderDialog";
import { OrderStatusBadge, PaymentBadge } from "@/components/shop/OrderBadges";
import { Button } from "@/components/ui/button";
import { useDemoStore } from "@/hooks/use-demo-store";
import { PENDING_STATUSES } from "@/lib/dashboard";
import { downloadText } from "@/lib/download";
import { inr, shortDate } from "@/lib/format";
import { ORDER_STATUSES, type OrderStatus, type PaymentStatus } from "@/lib/types";
import { orderStore, ordersToCsv } from "@/services/orderService";
import { LiveOrders } from "@/components/admin/live/LiveOrders";
import { isBackendConfigured } from "@/services/api";

type StatusFilter = OrderStatus | "pending" | "";
export const Route = createFileRoute("/admin/orders")({
  validateSearch: (s: Record<string, unknown>): { status?: StatusFilter | undefined } =>
    typeof s["status"] === "string" && (s["status"] === "pending" || ORDER_STATUSES.includes(s["status"] as OrderStatus)) ? { status: s["status"] as StatusFilter } : {},
  component: () => (isBackendConfigured() ? <LiveOrders /> : <Orders />),
});

function Orders() {
  const data = useDemoStore(orderStore);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const status: StatusFilter = search.status ?? "";
  const [q, setQ] = useState("");
  const [pay, setPay] = useState<PaymentStatus | "">("");
  const [creating, setCreating] = useState(false);
  const list = [...data].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).filter((o) =>
    (!q || `${o.id} ${o.customerName} ${o.customerPhone} ${o.customerEmail}`.toLowerCase().includes(q.toLowerCase())) &&
    (!status || (status === "pending" ? PENDING_STATUSES.includes(o.status) : o.status === status)) && (!pay || o.paymentStatus === pay));

  return (
    <AdminPage title="Orders" subtitle="Demo orders only — nothing here was really bought or paid. Kept for this browser tab (they can hold personal details)."
      actions={<div className="flex flex-wrap gap-2">
        <Button variant="luxOutline" size="xl" disabled={list.length === 0} onClick={() => downloadText(`orders-demo-${new Date().toISOString().slice(0, 10)}.csv`, ordersToCsv(list))}><Download /> Export CSV</Button>
        <Button variant="lux" size="xl" onClick={() => setCreating(true)}><Plus /> Create demo order</Button>
      </div>}>
      <Panel>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <input aria-label="Search orders" placeholder="Search by order ID, customer or phone" className={adminInput} value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Filter status" className={adminInput} value={status} onChange={(e) => navigate({ search: e.target.value ? { status: e.target.value as StatusFilter } : {} })}>
            <option value="">All statuses</option><option value="pending">Pending (new / confirmed / processing)</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
          <select aria-label="Filter payment" className={adminInput} value={pay} onChange={(e) => setPay(e.target.value as PaymentStatus)}>
            <option value="">All payments</option>{["paid", "pending", "failed", "refunded", "cod"].map((s) => <option key={s} value={s}>{s === "cod" ? "COD" : s}</option>)}
          </select>
        </div>
        {list.length > 0 && (
          <Table head={["Order", "Date", "Customer", "Items", "Payment", "Status", "Total"]}>
            {list.map((o) => (
              <tr key={o.id}>
                <Td><Link to="/admin/orders/$id" params={{ id: o.id }} className="font-semibold text-primary hover:underline">{o.id}</Link></Td>
                <Td>{shortDate(o.createdAt)}</Td><Td>{o.customerName}<div className="text-xs text-muted-foreground">{o.customerPhone}</div></Td>
                <Td>{o.items.reduce((s, i) => s + i.quantity, 0)}</Td>
                <Td><PaymentBadge status={o.paymentStatus} /></Td><Td><OrderStatusBadge status={o.status} /></Td><Td>{inr(o.total)}</Td>
              </tr>
            ))}
          </Table>
        )}
        {list.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{data.length === 0 ? "No orders yet — create a demo order to try the workflow." : "No orders match these filters."}</p>}
      </Panel>
      <NewOrderDialog open={creating} onOpenChange={setCreating} />
    </AdminPage>
  );
}
