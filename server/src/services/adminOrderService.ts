import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";

import { HttpError, badRequest, notFound } from "../errors.js";
import { formatInr, toPaise } from "../lib/money.js";
import { CANCELLABLE, ORDER_TRANSITIONS, STATUS_LABEL, canTransition, type OrderStatusKey } from "../lib/orderStatus.js";
import { logActivity, type Actor } from "./activity.js";
import type { CheckoutService } from "./checkoutService.js";
import { itemView, lockOrder, releaseDiscountUse, releaseStock, snapshotOf, totalsOf } from "./orderShared.js";

const STATUSES = ["PENDING_PAYMENT", "NEW", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"] as const;
const PAY_STATUSES = ["PENDING", "COD_PENDING", "PAID", "FAILED", "CANCELLED", "REFUNDED"] as const;

export const orderFilterSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(STATUSES).optional(),
  paymentStatus: z.enum(PAY_STATUSES).optional(),
  method: z.enum(["COD", "RAZORPAY"]).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  includeTest: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type OrderFilter = z.infer<typeof orderFilterSchema>;

export const statusChangeSchema = z.object({ to: z.enum(STATUSES), note: z.string().trim().max(500).optional(), restock: z.boolean().optional() });
export const noteSchema = z.object({ text: z.string().trim().min(1, "Write a note first").max(2000) });
export const cancelSchema = z.object({ reason: z.string().trim().min(3, "Give a reason for cancelling").max(300) });
export const shipmentSchema = z.object({
  carrier: z.string().trim().min(2).max(80),
  trackingNumber: z.string().trim().min(3).max(80).regex(/^[A-Za-z0-9 _/-]+$/, "Tracking numbers use letters, numbers, spaces, - _ /"),
  trackingUrl: z.union([z.literal(""), z.string().trim().url().max(500).refine((u) => u.startsWith("https://"), "Tracking links must start with https://")]).default(""),
});
export const codCollectSchema = z.object({
  amountPaise: z.number().int().positive(),
  reference: z.string().trim().min(2, "Add a reference (courier remittance id, receipt number…)").max(120),
  note: z.string().trim().max(500).optional(),
});

/** IST day boundaries for date filters (the store works in India time). */
export const istRange = (from?: string, to?: string) => ({
  ...(from ? { gte: new Date(`${from}T00:00:00+05:30`) } : {}),
  ...(to ? { lt: new Date(new Date(`${to}T00:00:00+05:30`).getTime() + 86_400_000) } : {}),
});

export function whereFor(f: Partial<OrderFilter>): Prisma.OrderWhereInput {
  const q = f.q?.trim();
  return {
    ...(f.includeTest ? {} : { isTest: false }),
    ...(f.status ? { status: f.status } : {}),
    ...(f.paymentStatus ? { paymentStatus: f.paymentStatus } : {}),
    ...(f.method ? { paymentMethod: f.method } : {}),
    ...(f.from || f.to ? { createdAt: istRange(f.from, f.to) } : {}),
    ...(q ? { OR: [{ orderNumber: { contains: q.toUpperCase() } }, { customerName: { contains: q } }, { phone: { contains: q.replace(/\D/g, "") || q } }, { email: { contains: q.toLowerCase() } }] } : {}),
  };
}

const summary = (o: Prisma.OrderGetPayload<{ include: { items: true } }>) => ({
  id: o.id, orderNumber: o.orderNumber, createdAt: o.createdAt.toISOString(), customerId: o.customerId, customerName: o.customerName,
  email: o.email, phone: o.phone, status: o.status, paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus,
  totals: totalsOf(o), itemCount: o.items.reduce((s, i) => s + i.quantity, 0), city: snapshotOf(o).city, isTest: o.isTest,
});

export function createAdminOrderService(prisma: PrismaClient, checkout: CheckoutService) {
  const detailInclude = {
    items: true,
    payments: { orderBy: { createdAt: "asc" } },
    events: { orderBy: { createdAt: "asc" } },
    paymentEvents: { orderBy: { createdAt: "asc" }, select: { id: true, eventType: true, source: true, signatureValid: true, outcome: true, amountPaise: true, providerPaymentId: true, createdAt: true } },
  } satisfies Prisma.OrderInclude;

  async function detail(id: string) {
    const o = await prisma.order.findUnique({ where: { id }, include: detailInclude });
    if (!o) throw notFound("Order not found.");
    const actorIds = [...new Set([...o.events.map((e) => e.actorUserId), ...o.payments.map((p) => p.recordedById)].filter((x): x is string => !!x))];
    const actors = new Map((await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
    return {
      ...summary(o),
      items: o.items.map(itemView),
      shippingAddress: snapshotOf(o),
      discountCode: o.discountCode,
      stockState: o.stockState,
      payBy: o.reservationExpiresAt?.toISOString() ?? null,
      paidAt: o.paidAt?.toISOString() ?? null,
      shipment: { carrier: o.carrier, trackingNumber: o.trackingNumber, trackingUrl: o.trackingUrl, shippedAt: o.shippedAt?.toISOString() ?? null, deliveredAt: o.deliveredAt?.toISOString() ?? null },
      cancelledAt: o.cancelledAt?.toISOString() ?? null,
      cancelReason: o.cancelReason,
      payments: o.payments.map((p) => ({
        id: p.id, method: p.method, status: p.status, amountPaise: toPaise(p.amount), providerOrderId: p.providerOrderId, providerPaymentId: p.providerPaymentId,
        providerMethod: p.providerMethod, signatureVerified: !!p.signatureVerifiedAt, capturedAt: p.capturedAt?.toISOString() ?? null,
        failureReason: p.failureReason, isTest: p.isTest, recordedBy: p.recordedById ? actors.get(p.recordedById) ?? "Admin" : null, reference: p.reference,
      })),
      timeline: o.events.map((e) => ({ id: e.id, at: e.createdAt.toISOString(), type: e.type, message: e.message, note: e.note, by: e.actorUserId ? actors.get(e.actorUserId) ?? "Admin" : null })),
      paymentEvents: o.paymentEvents.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
      allowedNext: ORDER_TRANSITIONS[o.status],
      canCancel: CANCELLABLE.includes(o.status),
      canRecordCod: o.paymentMethod === "COD" && o.paymentStatus === "COD_PENDING" && o.status !== "CANCELLED",
    };
  }

  return {
    async list(f: OrderFilter) {
      const where = whereFor(f);
      const [rows, total] = await Promise.all([
        prisma.order.findMany({ where, include: { items: true }, orderBy: { createdAt: "desc" }, skip: (f.page - 1) * f.pageSize, take: f.pageSize }),
        prisma.order.count({ where }),
      ]);
      return { orders: rows.map(summary), total, page: f.page, pageSize: f.pageSize };
    },

    detail,

    /** Fulfilment step change. Never touches payment state. */
    async changeStatus(id: string, input: z.infer<typeof statusChangeSchema>, actor: Actor) {
      if (input.to === "CANCELLED") throw badRequest("Use Cancel order to cancel.");
      await prisma.$transaction(async (tx) => {
        await lockOrder(tx, id);
        const o = await tx.order.findUnique({ where: { id }, include: { items: true } });
        if (!o) throw notFound("Order not found.");
        if (!canTransition(o.status as OrderStatusKey, input.to)) throw new HttpError(409, "invalid_transition", `An order that is “${STATUS_LABEL[o.status]}” can't be moved to “${STATUS_LABEL[input.to]}”.`);
        const now = new Date();
        let restocked = false;
        if (input.to === "RETURNED" && input.restock && o.stockState === "COMMITTED") { await releaseStock(tx, o.items, "committed"); restocked = true; }
        await tx.order.update({
          where: { id },
          data: { status: input.to, ...(input.to === "SHIPPED" ? { shippedAt: now } : {}), ...(input.to === "DELIVERED" ? { deliveredAt: now } : {}), ...(restocked ? { stockState: "RESTORED" } : {}) },
        });
        const msg = `Status changed: ${STATUS_LABEL[o.status]} → ${STATUS_LABEL[input.to]}${restocked ? " (items put back in stock)" : ""}${input.to === "DELIVERED" && o.paymentStatus === "COD_PENDING" ? " — cash not yet recorded as collected" : ""}`;
        await tx.orderEvent.create({ data: { orderId: id, type: "status", message: msg, actorUserId: actor.userId, note: input.note ?? null } });
        await logActivity(tx, actor, { action: "order.status", entityType: "order", entityId: id, summary: `${o.orderNumber}: ${msg}` });
      });
      return detail(id);
    },

    async addNote(id: string, text: string, actor: Actor) {
      const o = await prisma.order.findUnique({ where: { id }, select: { id: true, orderNumber: true } });
      if (!o) throw notFound("Order not found.");
      await prisma.orderEvent.create({ data: { orderId: id, type: "note", message: "Internal note added", note: text, actorUserId: actor.userId } });
      return detail(id);
    },

    async setShipment(id: string, input: z.infer<typeof shipmentSchema>, actor: Actor) {
      const o = await prisma.order.findUnique({ where: { id } });
      if (!o) throw notFound("Order not found.");
      if (["PENDING_PAYMENT", "CANCELLED"].includes(o.status)) throw new HttpError(409, "invalid_transition", "Tracking can't be added to an unpaid or cancelled order.");
      await prisma.$transaction(async (tx) => {
        await tx.order.update({ where: { id }, data: { carrier: input.carrier, trackingNumber: input.trackingNumber, trackingUrl: input.trackingUrl || null } });
        await tx.orderEvent.create({ data: { orderId: id, type: "shipment", message: `Tracking saved: ${input.carrier} ${input.trackingNumber}`, actorUserId: actor.userId } });
        await logActivity(tx, actor, { action: "order.shipment", entityType: "order", entityId: id, summary: `${o.orderNumber}: tracking ${input.carrier} ${input.trackingNumber}` });
      });
      return detail(id);
    },

    /** Cancel before shipping: stock goes back once; paid online orders are flagged for a manual Razorpay refund. */
    async cancel(id: string, reason: string, actor: Actor) {
      const pre = await prisma.order.findUnique({ where: { id }, include: { items: true, payments: true } });
      if (!pre) throw notFound("Order not found.");
      if (pre.status === "PENDING_PAYMENT") { try { await checkout.reconcileOne(pre); } catch { /* Razorpay unreachable: cancel below still releases the hold */ } }
      await prisma.$transaction(async (tx) => {
        await lockOrder(tx, id);
        const o = await tx.order.findUniqueOrThrow({ where: { id }, include: { items: true } });
        if (!CANCELLABLE.includes(o.status as OrderStatusKey)) throw new HttpError(409, "invalid_transition", `An order that is “${STATUS_LABEL[o.status]}” can't be cancelled.`);
        let stockState = o.stockState;
        if (o.stockState === "RESERVED") { await releaseStock(tx, o.items, "reserved"); stockState = "RELEASED"; }
        else if (o.stockState === "COMMITTED") { await releaseStock(tx, o.items, "committed"); stockState = "RESTORED"; }
        const paid = o.paymentStatus === "PAID";
        if (!paid) await releaseDiscountUse(tx, o.discountId);
        const paymentStatus = paid ? "PAID" : "CANCELLED";
        await tx.order.update({ where: { id }, data: { status: "CANCELLED", paymentStatus, stockState, cancelledAt: new Date(), cancelReason: reason, reservationExpiresAt: null } });
        if (!paid) await tx.payment.updateMany({ where: { orderId: id, status: "PENDING" }, data: { status: "FAILED", failureReason: "Order cancelled" } });
        const msg = `Order cancelled by staff: ${reason}${stockState !== o.stockState ? " — items put back in stock" : ""}${paid ? `. The customer paid ${formatInr(toPaise(o.grandTotal))} online — issue the refund from the Razorpay dashboard (not automatic).` : ""}`;
        await tx.orderEvent.create({ data: { orderId: id, type: "cancel", message: msg.slice(0, 500), actorUserId: actor.userId } });
        await logActivity(tx, actor, { action: "order.cancel", entityType: "order", entityId: id, summary: `${o.orderNumber}: ${msg}` });
      });
      return detail(id);
    },

    /** Audited cash collection for a COD order (full amount only). */
    async recordCodCollection(id: string, input: z.infer<typeof codCollectSchema>, actor: Actor) {
      await prisma.$transaction(async (tx) => {
        await lockOrder(tx, id);
        const o = await tx.order.findUnique({ where: { id }, include: { payments: true } });
        if (!o) throw notFound("Order not found.");
        if (o.paymentMethod !== "COD" || o.paymentStatus !== "COD_PENDING" || o.status === "CANCELLED") throw new HttpError(409, "invalid_transition", "Only an open Cash on Delivery order waiting for cash can be marked collected.");
        const total = toPaise(o.grandTotal);
        if (input.amountPaise !== total) throw badRequest(`The amount collected must equal the order total of ${formatInr(total)}. Partial collections aren't supported — add a note instead.`);
        const now = new Date();
        const pay = o.payments.find((p) => p.method === "COD");
        if (pay) await tx.payment.update({ where: { id: pay.id }, data: { status: "PAID", capturedAt: now, recordedById: actor.userId, reference: input.reference } });
        else await tx.payment.create({ data: { orderId: id, method: "COD", status: "PAID", amount: o.grandTotal, capturedAt: now, recordedById: actor.userId, reference: input.reference, isTest: o.isTest } });
        await tx.order.update({ where: { id }, data: { paymentStatus: "PAID", paidAt: now } });
        await tx.orderEvent.create({ data: { orderId: id, type: "cod_collected", message: `Cash collected: ${formatInr(total)} (ref. ${input.reference})`, note: input.note ?? null, actorUserId: actor.userId } });
        await logActivity(tx, actor, { action: "payment.cod_collected", entityType: "order", entityId: id, summary: `${o.orderNumber}: COD cash ${formatInr(total)} recorded, ref ${input.reference}` });
      });
      return detail(id);
    },

    /** CSV of real orders matching the filters (no paging). */
    async csv(f: OrderFilter) {
      const rows = await prisma.order.findMany({ where: whereFor(f), include: { items: true }, orderBy: { createdAt: "desc" }, take: 20_000 });
      const rupees = (p: number) => (p / 100).toFixed(2);
      const esc = (v: string | number | null) => { const s = v == null ? "" : String(v); const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe; };
      const head = ["Order number", "Date (IST)", "Customer", "Email", "Phone", "Items", "Subtotal", "Discount", "Discount code", "Shipping", "COD charge", "Total", "Payment method", "Payment status", "Order status", "City", "State", "PIN code", "Carrier", "Tracking number", "Test order"];
      const lines = rows.map((o) => {
        const t = totalsOf(o); const s = snapshotOf(o);
        return [o.orderNumber, new Date(o.createdAt.getTime() + 330 * 60_000).toISOString().slice(0, 16).replace("T", " "), o.customerName, o.email, o.phone,
          o.items.map((i) => `${i.productName} (${i.variantLabel}) x${i.quantity}`).join("; "),
          rupees(t.subtotalPaise), rupees(t.discountPaise), o.discountCode, rupees(t.shippingPaise), rupees(t.codFeePaise), rupees(t.totalPaise),
          o.paymentMethod, o.paymentStatus, o.status, s.city, s.state, s.pincode, o.carrier, o.trackingNumber, o.isTest ? "yes" : "no"].map(esc).join(",");
      });
      return [head.join(","), ...lines].join("\n");
    },
  };
}
export type AdminOrderService = ReturnType<typeof createAdminOrderService>;
