import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AdminPage, Panel, Table, Td, adminInput } from "@/components/admin/AdminUI";
import { OrderStatusBadge, PaymentBadge } from "@/components/shop/OrderBadges";
import { chipVariants } from "@/components/ui/button";
import { useAllProducts, useDemoStore } from "@/hooks/use-demo-store";
import { LOW_STOCK_AT, dashboardMetrics, rangeFor, totalStockOf, type RangeKey } from "@/lib/dashboard";
import { inr, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { customerStore } from "@/services/customerService";
import { orderStore } from "@/services/orderService";
import { LiveDashboard } from "@/components/admin/live/LiveDashboard";
import { isBackendConfigured } from "@/services/api";

export const Route = createFileRoute("/admin/")({ component: () => (isBackendConfigured() ? <LiveDashboard /> : <Overview />) });

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "custom", label: "Custom range" },
];

function Overview() {
  const orders = useDemoStore(orderStore);
  const customers = useDemoStore(customerStore);
  const products = useAllProducts();
  const [range, setRange] = useState<RangeKey>("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const r = useMemo(() => rangeFor(range, new Date(), { from, to }), [range, from, to]);
  const m = useMemo(() => dashboardMetrics(orders, products, customers.length, r), [orders, products, customers.length, r]);
  const recent = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const maxStatus = Math.max(1, ...m.statusBreakdown.map((s) => s.count));

  const cls = "block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const cards: { k: string; v: string | number; note: string; link: (n: ReactNode) => ReactNode }[] = [
    { k: "Total orders", v: m.orders, note: "In this period", link: (n) => <Link to="/admin/orders" className={cls}>{n}</Link> },
    { k: "Total sales", v: inr(m.sales), note: "Simulated · excl. cancelled/returned", link: (n) => <Link to="/admin/orders" className={cls}>{n}</Link> },
    { k: "Customers", v: m.customers, note: "Demo customers", link: (n) => <Link to="/admin/customers" className={cls}>{n}</Link> },
    { k: "Products", v: m.products, note: "Incl. hidden drafts", link: (n) => <Link to="/admin/products" className={cls}>{n}</Link> },
    { k: "Pending orders", v: m.pending, note: "New, confirmed or processing", link: (n) => <Link to="/admin/orders" search={{ status: "pending" }} className={cls}>{n}</Link> },
    { k: "Low stock", v: m.lowStock.length, note: `Under ${LOW_STOCK_AT} (demo stock)`, link: (n) => <Link to="/admin/products" search={{ show: "low-stock" }} className={cls}>{n}</Link> },
    { k: "High Demand", v: m.bestSellers, note: "Shown as Best Seller", link: (n) => <Link to="/admin/products" search={{ show: "best-seller" }} className={cls}>{n}</Link> },
  ];

  return (
    <AdminPage title="Overview" subtitle="Every figure is worked out from the demo data in this browser — sales and customers are simulated, not real.">
      <Panel>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Date range">
          {RANGES.map((x) => (
            <button key={x.key} type="button" aria-pressed={range === x.key} onClick={() => setRange(x.key)} className={cn(chipVariants({ active: range === x.key }))}>{x.label}</button>
          ))}
          {range === "custom" && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="df">From</label><input id="df" type="date" className={`${adminInput} w-40`} value={from} onChange={(e) => setFrom(e.target.value)} />
              <span className="text-xs text-muted-foreground">to</span>
              <label className="sr-only" htmlFor="dt">To</label><input id="dt" type="date" className={`${adminInput} w-40`} value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{shortDate(r.from.toISOString())} – {shortDate(r.to.toISOString())}</span>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        {cards.map((c) => <Fragment key={c.k}>{c.link(<Panel className="h-full"><p className="eyebrow">{c.k}</p><p className="mt-2 font-serif text-3xl">{c.v}</p><p className="mt-1 text-[10px] uppercase text-muted-foreground">{c.note}</p></Panel>)}</Fragment>)}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        <Panel title="Sales performance (simulated)">
          {m.orders === 0 ? <p className="py-16 text-center text-sm text-muted-foreground">No demo orders in this period. Try “Last 30 days” or create a demo order.</p> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={m.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v: number) => (v >= 1000 ? `₹${(v / 1000).toFixed(1).replace(/\.0$/, "")}k` : `₹${v}`)} />
                  <Tooltip formatter={(v: number) => inr(v)} cursor={{ fill: "var(--secondary)" }} />
                  <Bar dataKey="sales" name="Sales" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
        <Panel title="Order status breakdown">
          <ul className="space-y-2.5">
            {m.statusBreakdown.map((s) => (
              <li key={s.status}>
                <Link to="/admin/orders" search={{ status: s.status }} className="grid grid-cols-[100px_1fr_28px] items-center gap-3 text-sm hover:text-primary">
                  <OrderStatusBadge status={s.status} />
                  <span className="h-2 overflow-hidden rounded-full bg-secondary"><span className="block h-full rounded-full bg-primary" style={{ width: `${(s.count / maxStatus) * 100}%` }} /></span>
                  <span className="text-right tabular-nums">{s.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3 [&>*]:min-w-0">
        <Panel title="Recent orders" className="xl:col-span-2" action={<Link to="/admin/orders" className="text-xs text-primary hover:underline">View all</Link>}>
          {recent.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No orders yet.</p> : (
            <Table head={["Order", "Customer", "Payment", "Status", "Total"]}>
              {recent.map((o) => (
                <tr key={o.id}>
                  <Td><Link to="/admin/orders/$id" params={{ id: o.id }} className="font-semibold hover:underline">{o.id}</Link><div className="text-xs text-muted-foreground">{shortDate(o.createdAt)}</div></Td>
                  <Td>{o.customerName}</Td><Td><PaymentBadge status={o.paymentStatus} /></Td><Td><OrderStatusBadge status={o.status} /></Td><Td>{inr(o.total)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
        <div className="space-y-4">
          <Panel title="Top-selling products">
            {m.topProducts.length === 0 ? <p className="text-sm text-muted-foreground">No sales in this period.</p> : (
              <ol className="space-y-2 text-sm">
                {m.topProducts.map((t, i) => (
                  <li key={t.productId} className="flex items-center justify-between gap-3"><Link to="/admin/products/$id" params={{ id: t.productId }} className="truncate hover:underline"><span className="mr-2 text-muted-foreground">{i + 1}.</span>{t.name}</Link><span className="shrink-0 tabular-nums text-muted-foreground">{t.quantity} sold</span></li>
                ))}
              </ol>
            )}
          </Panel>
          <Panel title="Low-stock products (demo)">
            {m.lowStock.length === 0 ? <p className="text-sm text-muted-foreground">No visible product is under {LOW_STOCK_AT} units.</p> : (
              <ul className="space-y-2 text-sm">
                {m.lowStock.slice(0, 6).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3"><Link to="/admin/products/$id" params={{ id: p.id }} className="flex items-center gap-2 truncate hover:underline"><AlertTriangle className="size-3.5 shrink-0 text-warning" />{p.name}</Link><span className="tabular-nums">{totalStockOf(p)}</span></li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </AdminPage>
  );
}
