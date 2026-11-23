import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AdminPage, Panel, Table, Td, adminInput } from "@/components/admin/AdminUI";
import { chipVariants } from "@/components/ui/button";
import { inrPaise } from "@/lib/format";
import { adminCommerce } from "@/services/adminCommerceService";
import { LiveState, ORDER_STATUS_TEXT, PAYMENT_STATUS_TEXT, daysAgoIst, todayIst, useLive } from "./shared";

const RANGES = [{ k: "today", l: "Today", d: 0 }, { k: "7d", l: "Last 7 days", d: 6 }, { k: "30d", l: "Last 30 days", d: 29 }, { k: "custom", l: "Custom range", d: -1 }] as const;

/** Sales overview straight from MySQL. Shows zeros when there are no orders — never sample figures. */
export function LiveDashboard() {
  const [range, setRange] = useState<(typeof RANGES)[number]["k"]>("30d");
  const [from, setFrom] = useState(daysAgoIst(29));
  const [to, setTo] = useState(todayIst());
  const [includeTest, setIncludeTest] = useState(false);
  const pick = (k: (typeof RANGES)[number]["k"]) => {
    setRange(k);
    const r = RANGES.find((x) => x.k === k)!;
    if (r.d >= 0) { setFrom(daysAgoIst(r.d)); setTo(todayIst()); }
  };
  const { data: d, error, loading, reload } = useLive(() => adminCommerce.dashboard({ from, to, includeTest }), [from, to, includeTest]);

  const cards = d ? [
    { k: "Revenue (paid)", v: inrPaise(d.revenuePaise), n: `${d.paidOrders} verified paid order${d.paidOrders === 1 ? "" : "s"}` },
    { k: "COD to collect", v: inrPaise(d.codOutstandingPaise), n: `${d.codOutstandingOrders} order${d.codOutstandingOrders === 1 ? "" : "s"} — not revenue until collected` },
    { k: "Orders placed", v: d.orderCount, n: "Excludes unpaid online checkouts" },
    { k: "Awaiting online payment", v: d.awaitingPayment, n: "Stock held until paid or expired" },
  ] : [];

  return (
    <AdminPage title="Overview" subtitle="Live figures from the store database (India time).">
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => <button key={r.k} type="button" onClick={() => pick(r.k)} className={chipVariants({ active: range === r.k })}>{r.l}</button>)}
        {range === "custom" && <>
          <input type="date" aria-label="From" className={`${adminInput} w-auto`} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" aria-label="To" className={`${adminInput} w-auto`} value={to} min={from} max={todayIst()} onChange={(e) => setTo(e.target.value)} />
        </>}
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} /> Include test-mode orders</label>
      </div>
      <LiveState error={error} loading={loading && !d} onRetry={() => void reload()} />
      {d && <>
        {d.testOrders > 0 && !includeTest && <p className="rounded-md border border-accent/40 bg-accent/10 px-4 py-2 text-xs">{d.testOrders} test-mode order{d.testOrders === 1 ? " is" : "s are"} hidden from these figures (Razorpay Test Mode or a test store). They are never counted as sales.</p>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((c) => (
            <Link key={c.k} to="/admin/orders" className="block rounded-xl border border-border bg-card p-5 shadow-soft transition-shadow hover:shadow-lift">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{c.k}</p>
              <p className="mt-2 font-serif text-3xl tabular-nums">{c.v}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.n}</p>
            </Link>
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Panel title="Daily sales (paid) and orders">
            {d.series.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No orders in this period yet.</p> : (
              <div className="h-64"><ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.series.map((s) => ({ day: s.day.slice(5), sales: s.paidPaise / 100, orders: s.orders }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} />
                  <Tooltip formatter={(v: number, n: string) => (n === "sales" ? inrPaise(Math.round(v * 100)) : v)} />
                  <Bar dataKey="sales" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer></div>
            )}
          </Panel>
          <Panel title="Payments">
            {d.payments.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No payments in this period.</p> : (
              <ul className="space-y-2 text-sm">
                {d.payments.map((p) => <li key={`${p.method}-${p.status}`} className="flex justify-between gap-3"><span>{p.method === "COD" ? "Cash on Delivery" : "Razorpay"} · {PAYMENT_STATUS_TEXT[p.status]}</span><span className="tabular-nums">{p.orders} · {inrPaise(p.amountPaise)}</span></li>)}
              </ul>
            )}
            <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Orders by status</h3>
            <ul className="mt-2 grid grid-cols-2 gap-1 text-sm">
              {Object.entries(d.byStatus).map(([k, n]) => <li key={k} className="flex justify-between"><span>{ORDER_STATUS_TEXT[k as keyof typeof ORDER_STATUS_TEXT]}</span><span className="tabular-nums">{n}</span></li>)}
            </ul>
          </Panel>
        </div>
        <Panel title="Top-selling products">
          {d.topProducts.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No products sold in this period.</p> : (
            <Table head={["Product", "Units", "Sales (incl. COD not yet collected)"]}>
              {d.topProducts.map((t) => <tr key={`${t.productId}-${t.name}`}><Td>{t.name}</Td><Td>{t.quantity}</Td><Td>{inrPaise(t.salesPaise)}</Td></tr>)}
            </Table>
          )}
        </Panel>
      </>}
    </AdminPage>
  );
}
