// Order repository (demo). Orders hold people's names and addresses, so they are kept
// in sessionStorage (this tab only, survives refresh). Replace with Hostinger REST calls.
import { createDemoStore, isArrayOf, newId, nowIso } from "@/lib/demo-store";
import { evaluateDiscount } from "@/lib/discounts";
import { orders as seed } from "@/lib/mock-data";
import type { Order, OrderStatus, PaymentMethod } from "@/lib/types";
import { ORDER_STATUSES } from "@/lib/types";

export const orderStore = createDemoStore<Order[]>({
  key: "bya.demo.orders",
  label: "Orders",
  version: 2,
  scope: "session",
  seed: () => structuredClone(seed),
  validate: (v): v is Order[] => isArrayOf<Order>(v, (o) => typeof o["id"] === "string" && Array.isArray(o["items"]) && ORDER_STATUSES.includes(o["status"] as OrderStatus)),
});

const r = <T,>(v: T) => Promise.resolve(structuredClone(v));
const patch = (id: string, fn: (o: Order) => Order) => {
  orderStore.set((all) => all.map((o) => (o.id === id ? fn(o) : o)));
  return orderStore.get().find((o) => o.id === id) ?? null;
};

export interface NewOrderInput {
  customer: { id: string; name: string; email: string; phone: string; address: Order["shippingAddress"] };
  lines: { productId: string; variantId: string; quantity: number }[];
  paymentMethod: PaymentMethod;
  products: { id: string; name: string; variants: { id: string; label: string; price: number }[] }[];
  discount?: Parameters<typeof evaluateDiscount>[0] | undefined;
  now?: Date | undefined;
}

/** Builds a demo order (never charged): Razorpay orders stay "pending", COD orders "cod". */
export function buildDemoOrder(input: NewOrderInput, existing: Order[]): Order {
  const items = input.lines.filter((l) => l.quantity > 0).map((l) => {
    const p = input.products.find((x) => x.id === l.productId);
    const v = p?.variants.find((x) => x.id === l.variantId);
    if (!p || !v) throw new Error("A product in this order no longer exists.");
    return { productId: p.id, variantId: v.id, name: p.name, variantLabel: v.label, price: v.price, quantity: Math.floor(l.quantity) };
  });
  if (items.length === 0) throw new Error("Add at least one product.");
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const check = input.discount ? evaluateDiscount(input.discount, subtotal, input.now) : null;
  const discount = check?.ok ? check.amount : 0;
  const max = existing.reduce((m, o) => Math.max(m, Number(o.id.replace(/\D/g, "")) || 0), 1000);
  const at = (input.now ?? new Date()).toISOString();
  return {
    id: `BYA-${max + 1}`, customerId: input.customer.id, customerName: input.customer.name, customerEmail: input.customer.email,
    customerPhone: input.customer.phone, createdAt: at, items, subtotal, discount, discountCode: check?.ok ? input.discount?.code : undefined,
    shipping: null, total: subtotal - discount, paymentMethod: input.paymentMethod,
    paymentStatus: input.paymentMethod === "cod" ? "cod" : "pending", status: "new", shippingAddress: input.customer.address,
    notes: [], timeline: [{ at, label: "Demo order created in admin (nothing charged)" }], isDemo: true,
  };
}

export const orderService = {
  list: () => r(orderStore.get()),
  get: (id: string) => r(orderStore.get().find((o) => o.id === id) ?? null),
  forCustomer: (customerId: string) => r(orderStore.get().filter((o) => o.customerId === customerId)),
  updateStatus: (id: string, status: OrderStatus) =>
    r(patch(id, (o) => (o.status === status ? o : { ...o, status, timeline: [...o.timeline, { at: nowIso(), label: `Status changed from ${o.status} to ${status} (demo — customer not notified)` }] }))),
  addNote: (id: string, text: string) => {
    const t = text.trim();
    if (!t) return Promise.reject(new Error("Write a note first."));
    return r(patch(id, (o) => ({ ...o, notes: [...o.notes, { id: newId("n"), at: nowIso(), text: t }], timeline: [...o.timeline, { at: nowIso(), label: "Internal note added" }] })));
  },
  create: (input: NewOrderInput) => {
    try {
      const order = buildDemoOrder(input, orderStore.get());
      orderStore.set((all) => [order, ...all]);
      return r(order);
    } catch (e) { return Promise.reject(e); }
  },
};

/** CSV of the given orders (for the Export button). */
export function ordersToCsv(list: Order[]): string {
  const head = ["Order ID", "Date", "Customer", "Email", "Phone", "Items", "Subtotal", "Discount", "Shipping", "Total", "Payment method", "Payment status", "Order status", "City", "Demo"];
  const esc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const rows = list.map((o) => [
    o.id, o.createdAt.slice(0, 10), o.customerName, o.customerEmail, o.customerPhone,
    o.items.map((i) => `${i.name} (${i.variantLabel}) x${i.quantity}`).join("; "),
    o.subtotal, o.discount, o.shipping == null ? "Pending" : o.shipping, o.total, o.paymentMethod, o.paymentStatus, o.status, o.shippingAddress.city, "yes",
  ].map(esc).join(","));
  return [head.join(","), ...rows].join("\n");
}
