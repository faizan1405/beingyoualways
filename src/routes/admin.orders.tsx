import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AdminPage, Panel, Table, Td, adminInput } from "@/components/admin/AdminUI";
import { OrderStatusBadge, PaymentBadge } from "@/components/shop/OrderBadges";
import { inr, shortDate } from "@/lib/format";
import type { OrderStatus, PaymentStatus } from "@/lib/types";
import { orderService } from "@/services/orderService";

export const Route = createFileRoute("/admin/orders")({ component: Orders });

function Orders() {
  const { data = [], isLoading } = useQuery({ queryKey: ["admin", "orders"], queryFn: orderService.list });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [pay, setPay] = useState<PaymentStatus | "">("");
  const list = data.filter((o) =>
    (!q || `${o.id} ${o.customerName}`.toLowerCase().includes(q.toLowerCase())) && (!status || o.status === status) && (!pay || o.paymentStatus === pay));

  return (
    <AdminPage title="Orders" subtitle="Sample orders — no real orders exist yet.">
      <Panel>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <input aria-label="Search orders" placeholder="Search by order ID or customer" className={adminInput} value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Filter status" className={adminInput} value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
            <option value="">All statuses</option>{["placed", "confirmed", "packed", "shipped", "delivered", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select aria-label="Filter payment" className={adminInput} value={pay} onChange={(e) => setPay(e.target.value as PaymentStatus)}>
            <option value="">All payments</option>{["paid", "pending", "failed", "refunded", "cod"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {isLoading ? <div className="h-40 animate-pulse rounded bg-secondary" /> : (
          <Table head={["Order", "Date", "Customer", "Payment", "Status", "Total"]}>
            {list.map((o) => (
              <tr key={o.id} className="hover:bg-secondary/40">
                <Td><Link to="/admin/orders/$id" params={{ id: o.id }} className="font-semibold text-primary hover:underline">{o.id}</Link></Td>
                <Td>{shortDate(o.createdAt)}</Td><Td>{o.customerName}</Td>
                <Td><PaymentBadge status={o.paymentStatus} /></Td><Td><OrderStatusBadge status={o.status} /></Td><Td>{inr(o.total)}</Td>
              </tr>
            ))}
          </Table>
        )}
        {!isLoading && list.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No orders match these filters.</p>}
      </Panel>
    </AdminPage>
  );
}
