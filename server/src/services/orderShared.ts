import { Prisma, type Order, type OrderItem, type Payment } from "@prisma/client";

import { toPaise } from "../lib/money.js";
import { STATUS_LABEL } from "../lib/orderStatus.js";

export type Tx = Prisma.TransactionClient;
export const orderInclude = { items: true, payments: true } satisfies Prisma.OrderInclude;
export type OrderRow = Order & { items: OrderItem[]; payments: Payment[] };

export interface ShippingSnapshot { name: string; phone: string; line1: string; line2: string; city: string; state: string; pincode: string; type: string }
export const snapshotOf = (o: Pick<Order, "shippingSnapshot">) => o.shippingSnapshot as unknown as ShippingSnapshot;

export const totalsOf = (o: Order) => ({
  subtotalPaise: toPaise(o.subtotal),
  discountPaise: toPaise(o.discountTotal),
  shippingPaise: toPaise(o.shippingTotal),
  codFeePaise: toPaise(o.codFee),
  totalPaise: toPaise(o.grandTotal),
});

export const itemView = (i: OrderItem) => ({
  productId: i.productId, variantId: i.variantId, name: i.productName, variantLabel: i.variantLabel,
  unitPaise: toPaise(i.unitPrice), quantity: i.quantity, lineTotalPaise: toPaise(i.lineTotal),
});

/** What the shopper sees on their order page (no internal notes, no payment ids). */
export function publicOrder(o: OrderRow) {
  const s = snapshotOf(o);
  return {
    orderNumber: o.orderNumber,
    createdAt: o.createdAt.toISOString(),
    status: o.status,
    statusLabel: STATUS_LABEL[o.status],
    paymentMethod: o.paymentMethod === "COD" ? ("cod" as const) : ("razorpay" as const),
    paymentStatus: o.paymentStatus,
    items: o.items.map(itemView),
    totals: totalsOf(o),
    discountCode: o.discountCode,
    shipTo: { name: s.name, city: s.city, state: s.state, pincode: s.pincode },
    payBy: o.status === "PENDING_PAYMENT" && o.reservationExpiresAt ? o.reservationExpiresAt.toISOString() : null,
    isTest: o.isTest,
    shipment: o.trackingNumber ? { carrier: o.carrier, trackingNumber: o.trackingNumber, trackingUrl: o.trackingUrl } : null,
  };
}

/** Lock an order row for the rest of the transaction (serialises payment / cancel / expiry). */
export const lockOrder = (tx: Tx, id: string) => tx.$queryRaw`SELECT id FROM \`Order\` WHERE id = ${id} FOR UPDATE`;

const retryable = (e: unknown) => {
  const code = (e as { code?: string }).code;
  const msg = e instanceof Error ? e.message : "";
  return code === "P2034" || /deadlock|lock wait timeout|write conflict/i.test(msg);
};
/** Retries a transaction a few times when MySQL reports a deadlock between concurrent orders. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= attempts || !retryable(e)) throw e;
      await new Promise((r) => setTimeout(r, 20 * i + Math.floor(Math.random() * 30)));
    }
  }
}

export const isUniqueViolation = (e: unknown, field?: string) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && (!field || JSON.stringify(e.meta?.["target"] ?? "").includes(field));

/** Put back stock / reservations for an order's items. Sorted to avoid deadlocks. */
export async function releaseStock(tx: Tx, items: OrderItem[], kind: "reserved" | "committed") {
  for (const i of [...items].sort((a, b) => (a.variantId ?? "").localeCompare(b.variantId ?? ""))) {
    if (!i.variantId) continue;
    if (kind === "reserved") await tx.$executeRaw`UPDATE Inventory SET reserved = GREATEST(reserved - ${i.quantity}, 0) WHERE variantId = ${i.variantId}`;
    else await tx.$executeRaw`UPDATE Inventory SET quantity = quantity + ${i.quantity} WHERE variantId = ${i.variantId} AND quantity IS NOT NULL`;
  }
}

export const releaseDiscountUse = (tx: Tx, discountId: string | null) =>
  discountId ? tx.$executeRaw`UPDATE Discount SET usedCount = GREATEST(usedCount - 1, 0) WHERE id = ${discountId}` : Promise.resolve(0);
