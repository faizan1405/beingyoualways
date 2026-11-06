import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AdminPage, Panel, Table, Td } from "@/components/admin/AdminUI";
import { OrderStatusBadge } from "@/components/shop/OrderBadges";
import { inr, shortDate } from "@/lib/format";
import { customerService } from "@/services/customerService";
import { orderService } from "@/services/orderService";

export const Route = createFileRoute("/admin/customers_/$id")({ component: CustomerAdmin });

function CustomerAdmin() {
  const { id } = Route.useParams();
  const { data: c, isLoading } = useQuery({ queryKey: ["admin", "customer", id], queryFn: () => customerService.get(id) });
  const { data: orders = [] } = useQuery({ queryKey: ["admin", "customer-orders", id], queryFn: () => orderService.forCustomer(id) });
  if (isLoading) return <div className="h-96 animate-pulse rounded-xl bg-card" />;
  if (!c) return <p>Customer not found.</p>;
  return (
    <AdminPage title={c.name} subtitle={`Sample customer · joined ${shortDate(c.joinedAt)}`}>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Panel title="Profile">
          <dl className="space-y-2 text-sm">
            {[["Email", c.email], ["Phone", c.phone], ["Segment", c.segment], ["Orders", c.orderCount], ["Lifetime spend", inr(c.totalSpent)]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="capitalize">{v}</dd></div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">{c.addresses[0]?.line1}, {c.addresses[0]?.city}, {c.addresses[0]?.state}</p>
        </Panel>
        <Panel title="Order history">
          <Table head={["Order", "Date", "Status", "Total"]}>
            {orders.map((o) => (
              <tr key={o.id}><Td><Link to="/admin/orders/$id" params={{ id: o.id }} className="text-primary hover:underline">{o.id}</Link></Td><Td>{shortDate(o.createdAt)}</Td><Td><OrderStatusBadge status={o.status} /></Td><Td>{inr(o.total)}</Td></tr>
            ))}
          </Table>
          {orders.length === 0 && <p className="py-6 text-sm text-muted-foreground">No orders yet.</p>}
        </Panel>
      </div>
    </AdminPage>
  );
}
