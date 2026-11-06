import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AdminPage, Panel, Table, Td } from "@/components/admin/AdminUI";
import { OrderStatusBadge, PaymentBadge } from "@/components/shop/OrderBadges";
import { inr, shortDate } from "@/lib/format";
import { customerService } from "@/services/customerService";
import { orderService } from "@/services/orderService";
import { productService } from "@/services/productService";

export const Route = createFileRoute("/admin/")({ component: Overview });

function Overview() {
  const orders = useQuery({ queryKey: ["admin", "orders"], queryFn: orderService.list }).data ?? [];
  const products = useQuery({ queryKey: ["admin", "products"], queryFn: () => productService.list({ includeInactive: true }) }).data ?? [];
  const customers = useQuery({ queryKey: ["admin", "customers"], queryFn: customerService.list }).data ?? [];
  const series = useQuery({ queryKey: ["admin", "sales"], queryFn: orderService.salesSeries }).data ?? [];
  const revenue = orders.filter((o) => o.paymentStatus === "paid").reduce((s, o) => s + o.total, 0);

  return (
    <AdminPage title="Overview" subtitle="All figures are demonstration data.">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[["Revenue (paid)", inr(revenue)], ["Total orders", orders.length], ["Products", products.length], ["Customers", customers.length]].map(([k, v]) => (
          <Panel key={k}><p className="eyebrow">{k}</p><p className="mt-2 font-serif text-3xl">{v}</p><p className="mt-1 text-[10px] uppercase text-muted-foreground">Demo data</p></Panel>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr] [&>*]:min-w-0">
        <Panel title="Monthly sales (sample)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip formatter={(v: number) => inr(v)} cursor={{ fill: "var(--secondary)" }} />
                <Bar dataKey="revenue" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Recent orders" action={<Link to="/admin/orders" className="text-xs text-primary hover:underline">View all</Link>}>
          <Table head={["Order", "Customer", "Payment", "Status", "Total"]}>
            {orders.slice(0, 5).map((o) => (
              <tr key={o.id}>
                <Td><Link to="/admin/orders/$id" params={{ id: o.id }} className="font-semibold hover:underline">{o.id}</Link><div className="text-xs text-muted-foreground">{shortDate(o.createdAt)}</div></Td>
                <Td>{o.customerName}</Td><Td><PaymentBadge status={o.paymentStatus} /></Td><Td><OrderStatusBadge status={o.status} /></Td><Td>{inr(o.total)}</Td>
              </tr>
            ))}
          </Table>
        </Panel>
      </div>
    </AdminPage>
  );
}
