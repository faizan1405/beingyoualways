// Admin dashboard figures, worked out only from the current demo data (never typed in).
import type { Order, OrderStatus, Product } from "@/lib/types";
import { ORDER_STATUSES } from "@/lib/types";

export type RangeKey = "today" | "7d" | "30d" | "custom";
export interface DateRange { from: Date; to: Date }

/** Demo low-stock line (stock is demo data until real inventory is connected). */
export const LOW_STOCK_AT = 10;
/** Orders that still need action from the team. */
export const PENDING_STATUSES: OrderStatus[] = ["new", "confirmed", "processing"];
/** Orders that don't count towards sales. */
export const NON_SALE_STATUSES: OrderStatus[] = ["cancelled", "returned"];

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

export function rangeFor(key: RangeKey, now: Date, custom?: { from?: string; to?: string }): DateRange {
  if (key === "today") return { from: startOfDay(now), to: endOfDay(now) };
  if (key === "7d" || key === "30d") {
    const days = key === "7d" ? 7 : 30;
    const from = startOfDay(now);
    from.setDate(from.getDate() - (days - 1));
    return { from, to: endOfDay(now) };
  }
  const from = custom?.from ? startOfDay(new Date(custom.from)) : startOfDay(now);
  const to = custom?.to ? endOfDay(new Date(custom.to)) : endOfDay(now);
  return from <= to ? { from, to } : { from: startOfDay(to), to: endOfDay(from) };
}

export const inRange = (orders: Order[], r: DateRange) =>
  orders.filter((o) => { const t = new Date(o.createdAt).getTime(); return t >= r.from.getTime() && t <= r.to.getTime(); });

export const countsAsSale = (o: Order) => !NON_SALE_STATUSES.includes(o.status);
export const totalStockOf = (p: Product) => p.variants.reduce((s, v) => s + v.stock, 0);
export const isLowStock = (p: Product) => p.status === "active" && totalStockOf(p) < LOW_STOCK_AT;

export interface DashboardMetrics {
  orders: number;
  sales: number;
  customers: number;
  products: number;
  pending: number;
  lowStock: Product[];
  bestSellers: number;
  statusBreakdown: { status: OrderStatus; count: number }[];
  daily: { day: string; sales: number; orders: number }[];
  topProducts: { productId: string; name: string; quantity: number; revenue: number }[];
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function dashboardMetrics(allOrders: Order[], products: Product[], customerCount: number, r: DateRange): DashboardMetrics {
  const orders = inRange(allOrders, r);
  const sales = orders.filter(countsAsSale);
  const daily: DashboardMetrics["daily"] = [];
  const spanDays = Math.min(92, Math.max(1, Math.ceil((r.to.getTime() - r.from.getTime()) / 86_400_000)));
  for (let i = 0; i < spanDays; i++) {
    const d = new Date(r.from); d.setDate(d.getDate() + i);
    const k = dayKey(d);
    const own = sales.filter((o) => dayKey(new Date(o.createdAt)) === k);
    daily.push({ day: k.slice(5), sales: own.reduce((s, o) => s + o.total, 0), orders: own.length });
  }
  const top = new Map<string, { productId: string; name: string; quantity: number; revenue: number }>();
  for (const o of sales) for (const i of o.items) {
    const t = top.get(i.productId) ?? { productId: i.productId, name: i.name, quantity: 0, revenue: 0 };
    t.quantity += i.quantity; t.revenue += i.price * i.quantity;
    top.set(i.productId, t);
  }
  return {
    orders: orders.length,
    sales: sales.reduce((s, o) => s + o.total, 0),
    customers: customerCount,
    products: products.length,
    pending: orders.filter((o) => PENDING_STATUSES.includes(o.status)).length,
    lowStock: products.filter(isLowStock),
    bestSellers: products.filter((p) => p.status === "active" && p.bestSeller).length,
    statusBreakdown: ORDER_STATUSES.map((status) => ({ status, count: orders.filter((o) => o.status === status).length })),
    daily,
    topProducts: [...top.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue).slice(0, 5),
  };
}
