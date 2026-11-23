import { createHash, randomInt } from "node:crypto";

import { Prisma, type Discount, type PrismaClient } from "@prisma/client";

import type { Config } from "../config.js";
import { HttpError, notFound } from "../errors.js";
import type { CartLineInput, PlaceOrderInput, QuoteInput } from "../lib/checkoutSchema.js";
import { formatInr, fromPaise, toPaise } from "../lib/money.js";
import { codBlocker, computeTotals, evaluateDiscount, lineTotal, subtotalOf, type DiscountRule, type PricedLine } from "../lib/pricing.js";
import { inRegion, shippingProblems } from "../lib/settingsSchema.js";
import type { Logger } from "../logger.js";
import { checkOrderToken, orderToken } from "./orderLinks.js";
import {
  isUniqueViolation, lockOrder, orderInclude, publicOrder, releaseDiscountUse, releaseStock, snapshotOf, withRetry, type OrderRow, type Tx,
} from "./orderShared.js";
import { toGatewayPayment, type GatewayPayment, type PaymentGateway } from "./razorpay.js";
import type { SettingsService } from "./settingsService.js";

type Db = PrismaClient | Tx;

export type LineStatus = "ok" | "unavailable" | "sold_out" | "insufficient_stock" | "limit";
export interface LineView {
  productId: string; variantId: string; name: string; variantLabel: string; quantity: number;
  unitPaise: number; lineTotalPaise: number; status: LineStatus; message: string | null;
  priceChanged: { fromPaise: number; toPaise: number } | null;
}

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
/** BYA-YYMMDD-XXXXX (India date). Random suffix: unique without revealing order volume. */
export function newOrderNumber(now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60_000).toISOString();
  let suffix = "";
  for (let i = 0; i < 5; i++) suffix += ALPHABET[randomInt(ALPHABET.length)];
  return `BYA-${ist.slice(2, 4)}${ist.slice(5, 7)}${ist.slice(8, 10)}-${suffix}`;
}

/** Same variant twice in a request becomes one line. */
export function mergeLines(lines: CartLineInput[]): CartLineInput[] {
  const byVariant = new Map<string, CartLineInput>();
  for (const l of lines) {
    const prev = byVariant.get(l.variantId);
    if (prev && prev.productId !== l.productId) throw new HttpError(400, "bad_request", "A size or shade was sent with the wrong product.");
    byVariant.set(l.variantId, prev ? { ...prev, quantity: prev.quantity + l.quantity } : { ...l });
  }
  return [...byVariant.values()];
}

export const discountRuleOf = (d: Discount): DiscountRule => ({
  code: d.code, type: d.type, value: d.type === "PERCENT" ? Number(d.value) : toPaise(d.value),
  minOrderPaise: d.minOrder == null ? null : toPaise(d.minOrder), maxDiscountPaise: d.maxDiscount == null ? null : toPaise(d.maxDiscount),
  startsAt: d.startsAt, endsAt: d.endsAt, usageLimit: d.usageLimit, usedCount: d.usedCount, active: d.active,
  productIds: Array.isArray(d.productIds) ? (d.productIds as string[]) : null,
  categorySlugs: Array.isArray(d.categorySlugs) ? (d.categorySlugs as string[]) : null,
});

/** Prices every line from the database and checks it can be ordered. Never uses browser prices. */
export async function priceLines(db: Db, input: CartLineInput[], maxQtyPerLine: number) {
  const lines = mergeLines(input);
  const variants = await db.productVariant.findMany({
    where: { id: { in: lines.map((l) => l.variantId) } },
    include: { product: { include: { category: true } }, inventory: true },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));
  const views: LineView[] = [];
  const priced: PricedLine[] = [];
  for (const l of lines) {
    const v = byId.get(l.variantId);
    const usable = v && v.productId === l.productId && v.product.status === "ACTIVE";
    const unitPaise = v ? toPaise(v.price) : 0;
    const name = v?.product.name ?? "This item";
    const variantLabel = v?.label ?? "";
    let status: LineStatus = "ok";
    let message: string | null = null;
    if (!usable || unitPaise <= 0) { status = "unavailable"; message = `${name} is no longer available. Please remove it from your bag.`; }
    else if (v.inventory?.quantity == null) { status = "unavailable"; message = `${name}${variantLabel ? ` (${variantLabel})` : ""} can't be ordered right now. Please remove it from your bag.`; }
    else if (v.inventory.quantity - v.inventory.reserved <= 0) { status = "sold_out"; message = `${name}${variantLabel ? ` (${variantLabel})` : ""} is sold out. Please remove it from your bag.`; }
    else if (v.inventory.quantity - v.inventory.reserved < l.quantity) { status = "insufficient_stock"; message = `Only a limited quantity of ${name}${variantLabel ? ` (${variantLabel})` : ""} is available — please lower the quantity.`; }
    else if (l.quantity > maxQtyPerLine) { status = "limit"; message = `You can order up to ${maxQtyPerLine} of each item.`; }
    const seen = l.seenUnitPrice == null ? null : Math.round(l.seenUnitPrice * 100);
    views.push({
      productId: l.productId, variantId: l.variantId, name, variantLabel, quantity: l.quantity, unitPaise,
      lineTotalPaise: unitPaise * l.quantity, status, message,
      priceChanged: usable && seen != null && seen !== unitPaise ? { fromPaise: seen, toPaise: unitPaise } : null,
    });
    if (status === "ok" && v) priced.push({ productId: v.productId, variantId: v.id, categorySlug: v.product.category.slug, productName: v.product.name, variantLabel: v.label, unitPaise, quantity: l.quantity });
  }
  return { views, priced, ok: views.every((x) => x.status === "ok") };
}

const cartHashOf = (input: PlaceOrderInput) =>
  createHash("sha256").update(JSON.stringify({
    lines: mergeLines(input.lines).map((l) => [l.variantId, l.quantity]).sort(),
    m: input.paymentMethod, d: input.discountCode ?? "", p: input.address.pincode, ph: input.contact.phone,
  })).digest("hex");

export function createCheckoutService(deps: { prisma: PrismaClient; config: Config; settings: SettingsService; gateway: PaymentGateway | null; logger: Logger }) {
  const { prisma, config, settings, gateway, logger } = deps;

  async function discountFor(db: Db, code: string | undefined, priced: PricedLine[], now: Date) {
    if (!code) return null;
    const row = await db.discount.findUnique({ where: { code } });
    if (!row) return { row: null, result: { ok: false as const, reason: "This discount code doesn't exist." } };
    return { row, result: evaluateDiscount(discountRuleOf(row), priced, now) };
  }

  async function recordPaymentEvent(data: Prisma.PaymentEventUncheckedCreateInput) {
    try { await prisma.paymentEvent.create({ data }); } catch (e) { if (!isUniqueViolation(e)) throw e; }
  }

  const checkoutPayload = (o: OrderRow) => {
    const pay = o.payments.find((p) => p.method === "RAZORPAY");
    if (!gateway || !pay?.providerOrderId || o.status !== "PENDING_PAYMENT") return null;
    const s = snapshotOf(o);
    return {
      provider: "razorpay" as const, keyId: gateway.keyId, razorpayOrderId: pay.providerOrderId, amountPaise: toPaise(o.grandTotal), currency: "INR",
      description: `Order ${o.orderNumber}`, prefill: { name: s.name, email: o.email ?? "", contact: s.phone }, testMode: gateway.mode === "test",
    };
  };

  const result = (o: OrderRow, extra: { duplicate?: boolean; paymentStartFailed?: boolean } = {}) => ({
    order: publicOrder(o), accessToken: orderToken(config.orderLinkSecret, o.orderNumber), payment: checkoutPayload(o), ...extra,
  });

  const load = (db: Db, id: string) => db.order.findUniqueOrThrow({ where: { id }, include: orderInclude });

  /** Creates the Razorpay order for an internal order once (safe to call again). */
  async function ensureGatewayOrder(o: OrderRow): Promise<OrderRow> {
    const pay = o.payments.find((p) => p.method === "RAZORPAY");
    if (!gateway || !pay || pay.providerOrderId || o.status !== "PENDING_PAYMENT") return o;
    const amountPaise = toPaise(o.grandTotal);
    const go = await gateway.createOrder({ amountPaise, receipt: o.orderNumber, notes: { orderNumber: o.orderNumber } });
    if (go.amountPaise !== amountPaise || go.currency !== "INR") throw new Error("Razorpay order amount mismatch");
    const set = await prisma.payment.updateMany({ where: { id: pay.id, providerOrderId: null }, data: { providerOrderId: go.id } });
    if (set.count === 1) await prisma.orderEvent.create({ data: { orderId: o.id, type: "payment", message: `Online payment started (${gateway.mode === "test" ? "Razorpay TEST mode" : "Razorpay"})` } });
    return load(prisma, o.id);
  }

  async function createOrderTx(tx: Tx, input: PlaceOrderInput, cartHash: string) {
    const [shipping, cod] = [await settings.shipping(tx), await settings.cod(tx)];
    const { views, priced, ok } = await priceLines(tx, input.lines, shipping.maxQtyPerLine);
    if (!ok) throw new HttpError(409, "cart_changed", "Some items in your bag changed. Please review your bag before placing the order.", { lines: views });
    const now = new Date();
    const subtotal = subtotalOf(priced);

    let discountPaise = 0;
    let discountId: string | null = null;
    const d = await discountFor(tx, input.discountCode, priced, now);
    if (d) {
      if (!d.result.ok || !d.row) throw new HttpError(409, "discount_invalid", d.result.ok ? "This discount code doesn't exist." : d.result.reason);
      const claimed = await tx.$executeRaw`UPDATE Discount SET usedCount = usedCount + 1 WHERE id = ${d.row.id} AND active = true AND (usageLimit IS NULL OR usedCount < usageLimit)`;
      if (claimed !== 1) throw new HttpError(409, "discount_invalid", "This discount code has just been fully used.");
      discountPaise = d.result.amountPaise;
      discountId = d.row.id;
    }

    const isCod = input.paymentMethod === "cod";
    const base = computeTotals({ lines: priced, discountPaise, shipping, codFeePaise: 0 });
    let codFeePaise = 0;
    if (isCod) {
      const why = codBlocker(cod, base.totalPaise, input.address);
      if (why) throw new HttpError(409, "cod_unavailable", why);
      codFeePaise = cod.feePaise ?? 0;
    }
    const totals = computeTotals({ lines: priced, discountPaise, shipping, codFeePaise });
    if (totals.totalPaise <= 0) throw new HttpError(409, "invalid_total", "This order total can't be paid. Please contact the store.");

    // Stock: COD deducts now; online payment holds (reserves) until the payment is verified.
    for (const l of [...priced].sort((a, b) => a.variantId.localeCompare(b.variantId))) {
      const changed = isCod
        ? await tx.$executeRaw`UPDATE Inventory SET quantity = quantity - ${l.quantity} WHERE variantId = ${l.variantId} AND quantity IS NOT NULL AND quantity - reserved >= ${l.quantity}`
        : await tx.$executeRaw`UPDATE Inventory SET reserved = reserved + ${l.quantity} WHERE variantId = ${l.variantId} AND quantity IS NOT NULL AND quantity - reserved >= ${l.quantity}`;
      if (changed !== 1) throw new HttpError(409, "insufficient_stock", `Sorry — ${l.productName}${l.variantLabel ? ` (${l.variantLabel})` : ""} has just sold out or has fewer units left than you asked for.`);
    }

    const { contact, address } = input;
    let customer = await tx.customer.findUnique({ where: { phone: contact.phone } });
    if (customer?.status === "BLOCKED") throw new HttpError(403, "customer_blocked", "We can't take this order online. Please contact the store.");
    if (!customer) {
      const emailTaken = await tx.customer.findUnique({ where: { email: contact.email }, select: { id: true } });
      customer = await tx.customer.create({ data: { name: contact.name, phone: contact.phone, email: emailTaken ? null : contact.email } });
    } else if (!customer.email && !(await tx.customer.findUnique({ where: { email: contact.email }, select: { id: true } }))) {
      customer = await tx.customer.update({ where: { id: customer.id }, data: { email: contact.email } });
    }
    const addr = await tx.shippingAddress.create({
      data: { customerId: customer.id, label: address.type, name: contact.name, phone: contact.phone, line1: address.line1, line2: address.line2 || null, city: address.city, state: address.state, pincode: address.pincode },
    });

    const isTest = config.storeTestMode || (!isCod && gateway?.mode === "test");
    const snapshot = { name: contact.name, phone: contact.phone, line1: address.line1, line2: address.line2, city: address.city, state: address.state, pincode: address.pincode, type: address.type };
    const order = await tx.order.create({
      data: {
        orderNumber: newOrderNumber(now), customerId: customer.id, customerName: contact.name, email: contact.email, phone: contact.phone,
        status: isCod ? "NEW" : "PENDING_PAYMENT", paymentMethod: isCod ? "COD" : "RAZORPAY", paymentStatus: isCod ? "COD_PENDING" : "PENDING",
        subtotal: fromPaise(totals.subtotalPaise), discountTotal: fromPaise(totals.discountPaise), shippingTotal: fromPaise(totals.shippingPaise),
        codFee: fromPaise(totals.codFeePaise), grandTotal: fromPaise(totals.totalPaise),
        discountId, discountCode: discountId ? input.discountCode ?? null : null,
        shippingAddressId: addr.id, shippingSnapshot: snapshot,
        stockState: isCod ? "COMMITTED" : "RESERVED", reservationExpiresAt: isCod ? null : new Date(now.getTime() + config.paymentHoldMs),
        checkoutKey: input.checkoutKey, cartHash, isTest,
        items: { create: priced.map((l) => ({ productId: l.productId, variantId: l.variantId, productName: l.productName, variantLabel: l.variantLabel, unitPrice: fromPaise(l.unitPaise), quantity: l.quantity, lineTotal: fromPaise(lineTotal(l)) })) },
        payments: { create: { method: isCod ? "COD" : "RAZORPAY", status: "PENDING", amount: fromPaise(totals.totalPaise), isTest } },
        events: {
          create: [{
            type: "created",
            message: isCod
              ? `Order placed — Cash on Delivery, ${formatInr(totals.totalPaise)} to collect on delivery${isTest ? " (TEST order)" : ""}`
              : `Order placed — waiting for online payment of ${formatInr(totals.totalPaise)}; stock held for ${Math.round(config.paymentHoldMs / 60_000)} minutes${isTest ? " (TEST order)" : ""}`,
          }],
        },
      },
      include: orderInclude,
    });
    if (subtotal !== totals.subtotalPaise) throw new Error("subtotal drift"); // defensive
    return order;
  }

  /** Verified Razorpay payment → order paid, held stock committed. Idempotent and safe out of order. */
  async function applyPaid(orderId: string, gp: GatewayPayment, source: "checkout" | "webhook" | "reconcile", signatureVerified = false): Promise<string> {
    return withRetry(() => prisma.$transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const o = await load(tx, orderId);
      const pay = o.payments.find((p) => p.method === "RAZORPAY" && p.providerOrderId === gp.orderId);
      if (!pay) return "rejected_mismatch";
      if (gp.amountPaise !== toPaise(o.grandTotal) || gp.currency !== "INR") {
        await tx.orderEvent.create({ data: { orderId, type: "payment", message: `Payment ${gp.id} was refused: amount or currency did not match the order.` } });
        return "rejected_mismatch";
      }
      if (o.paymentStatus === "PAID" || o.paymentStatus === "REFUNDED") {
        if (pay.providerPaymentId && pay.providerPaymentId !== gp.id) {
          await tx.orderEvent.create({ data: { orderId, type: "payment", message: `A second online payment (${gp.id}) arrived for this already-paid order — refund it from the Razorpay dashboard.` } });
          return "duplicate_payment";
        }
        return "ignored_already_paid";
      }
      const shortfall: string[] = [];
      const sorted = [...o.items].sort((a, b) => (a.variantId ?? "").localeCompare(b.variantId ?? ""));
      if (o.stockState === "RESERVED") {
        for (const i of sorted) {
          if (!i.variantId) continue;
          const n = await tx.$executeRaw`UPDATE Inventory SET quantity = quantity - ${i.quantity}, reserved = reserved - ${i.quantity} WHERE variantId = ${i.variantId} AND reserved >= ${i.quantity} AND quantity >= ${i.quantity}`;
          if (n !== 1) shortfall.push(`${i.productName} (${i.variantLabel}) × ${i.quantity}`);
        }
      } else if (o.stockState === "RELEASED") {
        for (const i of sorted) {
          if (!i.variantId) continue;
          const n = await tx.$executeRaw`UPDATE Inventory SET quantity = quantity - ${i.quantity} WHERE variantId = ${i.variantId} AND quantity IS NOT NULL AND quantity - reserved >= ${i.quantity}`;
          if (n !== 1) shortfall.push(`${i.productName} (${i.variantLabel}) × ${i.quantity}`);
        }
        if (o.discountId) await tx.$executeRaw`UPDATE Discount SET usedCount = usedCount + 1 WHERE id = ${o.discountId}`;
      }
      const late = o.status === "CANCELLED";
      const now = new Date();
      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: "PAID", paidAt: now, status: o.status === "PENDING_PAYMENT" || late ? "NEW" : o.status, stockState: "COMMITTED", reservationExpiresAt: null, ...(late ? { cancelledAt: null, cancelReason: null } : {}) },
      });
      await tx.payment.update({
        where: { id: pay.id },
        data: { status: "PAID", providerPaymentId: gp.id, providerMethod: gp.method?.slice(0, 30) ?? null, capturedAt: now, failureReason: null, ...(signatureVerified ? { signatureVerifiedAt: now } : {}) },
      });
      const via = { checkout: "checkout signature + Razorpay payment record", webhook: "signed Razorpay webhook", reconcile: "Razorpay payment check" }[source];
      await tx.orderEvent.create({ data: { orderId, type: "payment", message: `Payment received online — ${formatInr(gp.amountPaise)}${gp.method ? ` by ${gp.method}` : ""}${o.isTest ? " (TEST mode, not a real sale)" : ""}. Verified by ${via}.` } });
      if (late) await tx.orderEvent.create({ data: { orderId, type: "status", message: "Payment arrived after the order had expired — the order was reopened." } });
      if (shortfall.length) await tx.orderEvent.create({ data: { orderId, type: "stock", message: `Needs attention: not enough stock for ${shortfall.join(", ")}. Contact the customer or refund.` } });
      return "applied";
    }, { timeout: 20_000 }));
  }

  async function recordAttemptFailed(orderId: string, reason: string): Promise<string> {
    return prisma.$transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const o = await load(tx, orderId);
      if (o.paymentStatus !== "PENDING") return "ignored_stale"; // never downgrade a paid / closed order
      const pay = o.payments.find((p) => p.method === "RAZORPAY");
      if (pay) await tx.payment.update({ where: { id: pay.id }, data: { failureReason: reason.slice(0, 255) } });
      await tx.orderEvent.create({ data: { orderId, type: "payment", message: `Online payment not completed: ${reason.slice(0, 200)}. The shopper can try again until the hold ends.` } });
      return "recorded";
    });
  }

  /** Unpaid online order → cancelled, held stock and discount use given back. */
  async function releaseUnpaid(orderId: string, reason: string, finalStatus: "FAILED" | "CANCELLED") {
    return prisma.$transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const o = await load(tx, orderId);
      if (o.status !== "PENDING_PAYMENT" || o.paymentStatus !== "PENDING") return false;
      if (o.stockState === "RESERVED") await releaseStock(tx, o.items, "reserved");
      await releaseDiscountUse(tx, o.discountId);
      await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED", paymentStatus: finalStatus, stockState: o.stockState === "RESERVED" ? "RELEASED" : o.stockState, cancelledAt: new Date(), cancelReason: reason, reservationExpiresAt: null } });
      await tx.payment.updateMany({ where: { orderId, method: "RAZORPAY", status: "PENDING" }, data: { status: "FAILED" } });
      await tx.orderEvent.create({ data: { orderId, type: "cancel", message: `${reason} — held stock released.` } });
      return true;
    });
  }

  /** Asks Razorpay what happened to an unpaid order (interrupted checkout, missed webhook). */
  async function reconcileOne(o: OrderRow): Promise<string> {
    const pay = o.payments.find((p) => p.method === "RAZORPAY");
    if (!gateway || !pay?.providerOrderId || o.paymentStatus !== "PENDING") return "skipped";
    const total = toPaise(o.grandTotal);
    const payments = await gateway.fetchOrderPayments(pay.providerOrderId);
    let hit = payments.find((p) => p.status === "captured" && p.amountPaise === total && p.currency === "INR");
    if (!hit) {
      const auth = payments.find((p) => p.status === "authorized" && p.amountPaise === total && p.currency === "INR");
      if (auth) { const c = await gateway.capture(auth.id, total); if (c.status === "captured") hit = c; }
    }
    if (!hit) return "nothing_paid";
    const outcome = await applyPaid(o.id, { ...hit, orderId: hit.orderId ?? pay.providerOrderId }, "reconcile");
    await recordPaymentEvent({ provider: "razorpay", eventId: `reconcile:${hit.id}`, eventType: "payment.captured", source: "reconcile", signatureValid: true, orderId: o.id, paymentId: pay.id, providerOrderId: pay.providerOrderId, providerPaymentId: hit.id, amountPaise: hit.amountPaise, outcome });
    return outcome;
  }

  async function access(orderNumber: string, token: string) {
    const o = checkOrderToken(config.orderLinkSecret, orderNumber, token) ? await prisma.order.findUnique({ where: { orderNumber }, include: orderInclude }) : null;
    if (!o) throw notFound("We couldn't find that order. Check the link from your confirmation page.");
    return o;
  }

  const svc = {
    priceLines: (lines: CartLineInput[], maxQty?: number) => settings.shipping().then((s) => priceLines(prisma, lines, maxQty ?? s.maxQtyPerLine)),

    /** Bag / checkout totals from database prices and the owner's rules. Nothing is reserved. */
    async quote(input: QuoteInput) {
      const [shipping, cod] = await Promise.all([settings.shipping(), settings.cod()]);
      const { views, priced, ok } = await priceLines(prisma, input.lines, shipping.maxQtyPerLine);
      const blockers: { code: string; message: string }[] = [];
      if (!ok) blockers.push({ code: "cart_changed", message: "Some items in your bag need your attention." });
      const shipReady = shippingProblems(shipping).length === 0;
      if (!shipReady) blockers.push({ code: "shipping_not_configured", message: "Ordering is paused while the store finishes setting up delivery charges. Please check back soon." });
      const dest = input.destination;
      const deliverable = !dest || !shipReady || inRegion(shipping.regions, dest.state, dest.pincode);
      if (!deliverable) blockers.push({ code: "no_delivery", message: "Sorry, we don't deliver to this PIN code yet." });

      const d = await discountFor(prisma, input.discountCode, priced, new Date());
      const discountPaise = d?.result.ok ? d.result.amountPaise : 0;
      const base = shipReady && priced.length ? computeTotals({ lines: priced, discountPaise, shipping, codFeePaise: 0 }) : null;
      const codWhy = !shipReady ? "Cash on Delivery isn't available right now." : base ? codBlocker(cod, base.totalPaise, dest) : null;
      const codFee = codWhy ? 0 : cod.feePaise ?? 0;
      const razorpayWhy = gateway ? null : "Online payment isn't switched on yet.";
      if (input.paymentMethod === "cod" && codWhy) blockers.push({ code: "cod_unavailable", message: codWhy });
      if (input.paymentMethod === "razorpay" && razorpayWhy) blockers.push({ code: "payment_unavailable", message: razorpayWhy });
      if (input.discountCode && d && !d.result.ok) blockers.push({ code: "discount_invalid", message: d.result.reason });
      const totals = base ? computeTotals({ lines: priced, discountPaise, shipping, codFeePaise: input.paymentMethod === "cod" && !codWhy ? codFee : 0 }) : null;
      return {
        lines: views,
        totals,
        discount: input.discountCode ? (d?.result.ok ? { code: input.discountCode, ok: true, amountPaise: d.result.amountPaise, message: null } : { code: input.discountCode, ok: false, amountPaise: 0, message: d?.result.ok === false ? d.result.reason : null }) : null,
        shipping: { configured: shipReady, deliverable },
        methods: { cod: { available: !codWhy, feePaise: codWhy ? null : codFee, reason: codWhy }, razorpay: { available: !razorpayWhy, testMode: gateway?.mode === "test", reason: razorpayWhy } },
        blockers,
        canPlaceOrder: blockers.length === 0 && priced.length > 0 && !!input.paymentMethod,
      };
    },

    async placeOrder(input: PlaceOrderInput) {
      const shipping = await settings.shipping();
      if (shippingProblems(shipping).length) throw new HttpError(409, "shipping_not_configured", "Ordering is paused while the store finishes setting up delivery charges. Nothing was charged.");
      if (!inRegion(shipping.regions, input.address.state, input.address.pincode)) throw new HttpError(409, "no_delivery", "Sorry, we don't deliver to this PIN code yet.");
      if (input.paymentMethod === "razorpay" && !gateway) throw new HttpError(409, "payment_unavailable", "Online payment isn't switched on yet. Please choose another payment method.");
      const cartHash = cartHashOf(input);

      const replay = async (existing: OrderRow) => {
        if (existing.cartHash !== cartHash) throw new HttpError(409, "checkout_reused", "This checkout was already used for a different order. Please refresh the checkout page.");
        return result(existing, { duplicate: true });
      };
      const prior = await prisma.order.findUnique({ where: { checkoutKey: input.checkoutKey }, include: orderInclude });
      if (prior) return replay(prior);

      let order: OrderRow | null = null;
      for (let attempt = 1; !order; attempt++) {
        try {
          order = await withRetry(() => prisma.$transaction((tx) => createOrderTx(tx, input, cartHash), { timeout: 20_000 }));
        } catch (e) {
          if (!isUniqueViolation(e)) throw e;
          // A twin submission committed first (same checkout key), or two first-time orders from the
          // same phone created the customer at once, or an order-number collision: re-check, then retry.
          const again = await prisma.order.findUnique({ where: { checkoutKey: input.checkoutKey }, include: orderInclude });
          if (again) return replay(again);
          if (attempt >= 4) throw e;
        }
      }
      logger.info("order placed", { orderNumber: order.orderNumber, method: order.paymentMethod, test: order.isTest });
      if (order.paymentMethod === "RAZORPAY") {
        try { order = await ensureGatewayOrder(order); } catch (e) {
          logger.error("razorpay order create failed", { orderNumber: order.orderNumber, error: e instanceof Error ? e.message : String(e) });
          await prisma.orderEvent.create({ data: { orderId: order.id, type: "payment", message: "Couldn't start the online payment with Razorpay — the shopper can retry." } });
          return result(order, { paymentStartFailed: true });
        }
      }
      return result(order);
    },

    /** Shopper's order page. Unpaid online orders are checked with Razorpay first. */
    async lookup(orderNumber: string, token: string) {
      let o = await access(orderNumber, token);
      if (o.status === "PENDING_PAYMENT") {
        try { await reconcileOne(o); } catch (e) { logger.warn("reconcile on lookup failed", { orderNumber, error: e instanceof Error ? e.message : String(e) }); }
        o = await load(prisma, o.id);
        if (o.status === "PENDING_PAYMENT" && o.reservationExpiresAt && o.reservationExpiresAt < new Date()) {
          await releaseUnpaid(o.id, "Payment wasn't completed in time", "CANCELLED");
          o = await load(prisma, o.id);
        }
      }
      return result(o);
    },

    /** Re-open payment for the same order (no second order is created). */
    async retryPayment(orderNumber: string, token: string) {
      const r = await svc.lookup(orderNumber, token);
      if (r.order.status !== "PENDING_PAYMENT") throw new HttpError(409, "not_payable", r.order.paymentStatus === "PAID" ? "This order is already paid." : "This order can no longer be paid. Please place a new order.");
      let o = await access(orderNumber, token);
      o = await ensureGatewayOrder(o);
      return result(o);
    },

    /** Razorpay Checkout success handler → verify signature, then confirm with Razorpay itself. */
    async verifyPayment(input: { orderNumber: string; token: string; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
      if (!gateway) throw new HttpError(409, "payment_unavailable", "Online payment isn't switched on.");
      const o = await access(input.orderNumber, input.token);
      const pay = o.payments.find((p) => p.method === "RAZORPAY");
      const base = { provider: "razorpay", source: "checkout", orderId: o.id, paymentId: pay?.id ?? null, providerOrderId: input.razorpay_order_id, providerPaymentId: input.razorpay_payment_id };
      if (!pay?.providerOrderId || pay.providerOrderId !== input.razorpay_order_id) {
        await recordPaymentEvent({ ...base, eventId: `checkout:mismatch:${input.razorpay_payment_id}`, eventType: "checkout.success", signatureValid: false, outcome: "rejected_mismatch", detail: "Razorpay order id does not belong to this order" });
        throw new HttpError(400, "payment_mismatch", "This payment doesn't belong to this order.");
      }
      if (!gateway.verifyCheckoutSignature(input.razorpay_order_id, input.razorpay_payment_id, input.razorpay_signature)) {
        await recordPaymentEvent({ ...base, eventId: `checkout:badsig:${input.razorpay_payment_id}:${Date.now()}`, eventType: "checkout.success", signatureValid: false, outcome: "rejected_signature" });
        throw new HttpError(400, "invalid_signature", "We couldn't verify this payment. If money left your account, it will be confirmed automatically or refunded by Razorpay.");
      }
      let gp = await gateway.fetchPayment(input.razorpay_payment_id);
      const total = toPaise(o.grandTotal);
      if (gp.orderId !== pay.providerOrderId || gp.amountPaise !== total || gp.currency !== "INR") {
        await recordPaymentEvent({ ...base, eventId: `checkout:mismatch:${gp.id}`, eventType: "checkout.success", signatureValid: true, amountPaise: gp.amountPaise, outcome: "rejected_mismatch", detail: "Amount, currency or order did not match" });
        throw new HttpError(400, "payment_mismatch", "The payment amount didn't match this order. Please contact the store.");
      }
      if (gp.status === "authorized") gp = await gateway.capture(gp.id, total);
      let outcome = "pending";
      if (gp.status === "captured") outcome = await applyPaid(o.id, gp, "checkout", true);
      else if (gp.status === "failed") outcome = await recordAttemptFailed(o.id, gp.errorDescription ?? "Payment failed");
      await recordPaymentEvent({ ...base, eventId: `checkout:${gp.id}:${gp.status}`, eventType: "checkout.success", signatureValid: true, amountPaise: gp.amountPaise, outcome });
      return svc.lookup(input.orderNumber, input.token);
    },

    /** Checkout closed or payment failed in the Razorpay window. The order stays payable until the hold ends. */
    async reportProblem(input: { orderNumber: string; token: string; kind: "cancelled" | "failed"; razorpay_payment_id?: string | undefined; reason?: string | undefined }) {
      const o = await access(input.orderNumber, input.token);
      const reason = input.kind === "cancelled" ? "payment window closed by the shopper" : `payment failed${input.reason ? ` (${input.reason})` : ""}`;
      const outcome = await recordAttemptFailed(o.id, reason);
      await recordPaymentEvent({ provider: "razorpay", eventId: `checkout:${input.kind}:${o.id}:${Date.now()}`, eventType: `checkout.${input.kind}`, source: "checkout", signatureValid: false, orderId: o.id, providerPaymentId: input.razorpay_payment_id ?? null, outcome, detail: "Reported by the browser — informational only" });
      return svc.lookup(input.orderNumber, input.token);
    },

    /** Signed Razorpay webhook. Stored once per event id; failures are rolled back so Razorpay retries. */
    async handleWebhook(rawBody: Buffer, signature: string | undefined, eventIdHeader: string | undefined) {
      if (!gateway) throw new HttpError(503, "payments_off", "Online payments are not configured.");
      if (!gateway.verifyWebhookSignature(rawBody, signature)) {
        logger.warn("razorpay webhook rejected: bad signature");
        throw new HttpError(400, "invalid_signature", "Invalid webhook signature.");
      }
      let body: { event?: string; payload?: { payment?: { entity?: Record<string, unknown> }; order?: { entity?: { id?: string } } } };
      try { body = JSON.parse(rawBody.toString("utf8")); } catch { throw new HttpError(400, "invalid_json", "Invalid JSON."); }
      const event = String(body.event ?? "unknown").slice(0, 60);
      const eventId = `wh:${(eventIdHeader?.trim() || createHash("sha256").update(rawBody).digest("hex")).slice(0, 100)}`;
      const entity = body.payload?.payment?.entity as Parameters<typeof toGatewayPayment>[0] | undefined;
      const gp = entity?.id ? toGatewayPayment(entity) : null;
      const providerOrderId = gp?.orderId ?? body.payload?.order?.entity?.id ?? null;

      let ev;
      try {
        ev = await prisma.paymentEvent.create({ data: { provider: "razorpay", eventId, eventType: event, source: "webhook", signatureValid: true, providerOrderId, providerPaymentId: gp?.id ?? null, amountPaise: gp?.amountPaise ?? null, outcome: "processing" } });
      } catch (e) {
        if (isUniqueViolation(e)) return { received: true, duplicate: true };
        throw e;
      }
      try {
        const pay = providerOrderId ? await prisma.payment.findUnique({ where: { providerOrderId } }) : null;
        let outcome = pay ? "ignored_event" : "ignored_unknown_order";
        if (pay && gp) {
          if (event === "payment.captured" || event === "order.paid") outcome = await applyPaid(pay.orderId, { ...gp, status: "captured" }, "webhook");
          else if (event === "payment.authorized") {
            const o = await load(prisma, pay.orderId);
            if (o.paymentStatus !== "PENDING") outcome = "ignored_stale";
            else if (gp.amountPaise !== toPaise(o.grandTotal)) outcome = "rejected_mismatch";
            else { const c = await gateway.capture(gp.id, gp.amountPaise); outcome = c.status === "captured" ? await applyPaid(pay.orderId, c, "webhook") : "recorded"; }
          } else if (event === "payment.failed") outcome = await recordAttemptFailed(pay.orderId, gp.errorDescription ?? "payment failed");
          else if (event.startsWith("refund.")) {
            const refunded = Number((entity as Record<string, unknown> | undefined)?.["amount_refunded"] ?? 0);
            await prisma.orderEvent.create({ data: { orderId: pay.orderId, type: "payment", message: `Razorpay reports a refund (${event}) — ${formatInr(refunded)} refunded so far.` } });
            if (refunded >= gp.amountPaise && refunded > 0) {
              await prisma.$transaction([
                prisma.order.update({ where: { id: pay.orderId }, data: { paymentStatus: "REFUNDED" } }),
                prisma.payment.update({ where: { id: pay.id }, data: { status: "REFUNDED" } }),
              ]);
            }
            outcome = "recorded";
          }
        }
        await prisma.paymentEvent.update({ where: { id: ev.id }, data: { outcome, orderId: pay?.orderId ?? null, paymentId: pay?.id ?? null } });
        return { received: true, outcome };
      } catch (e) {
        await prisma.paymentEvent.delete({ where: { id: ev.id } }).catch(() => undefined);
        throw e;
      }
    },

    /** Releases unpaid online orders past their hold (after one last check with Razorpay). */
    async expireStale(now = new Date()) {
      const stale = await prisma.order.findMany({ where: { status: "PENDING_PAYMENT", paymentStatus: "PENDING", reservationExpiresAt: { lt: now } }, include: orderInclude, take: 100 });
      let released = 0, paid = 0;
      for (const o of stale) {
        try {
          if ((await reconcileOne(o)) === "applied") { paid++; continue; }
        } catch (e) { logger.warn("reconcile before expiry failed — will retry", { orderNumber: o.orderNumber, error: e instanceof Error ? e.message : String(e) }); continue; }
        const failed = o.payments.some((p) => p.failureReason);
        if (await releaseUnpaid(o.id, `Payment wasn't completed within ${Math.round(config.paymentHoldMs / 60_000)} minutes`, failed ? "FAILED" : "CANCELLED")) released++;
      }
      return { checked: stale.length, released, paid };
    },

    /** Checks every unpaid online order with Razorpay (missed webhooks, closed tabs), then expires old holds. */
    async reconcileAll() {
      const pending = await prisma.order.findMany({ where: { status: "PENDING_PAYMENT", paymentStatus: "PENDING", payments: { some: { providerOrderId: { not: null } } } }, include: orderInclude, take: 200 });
      let paid = 0;
      for (const o of pending) {
        try { if ((await reconcileOne(o)) === "applied") paid++; } catch (e) { logger.warn("reconcile failed", { orderNumber: o.orderNumber, error: e instanceof Error ? e.message : String(e) }); }
      }
      const expiry = await svc.expireStale();
      return { checked: pending.length, paid, expired: expiry.released };
    },

    releaseUnpaid,
    reconcileOne,
  };
  return svc;
}
export type CheckoutService = ReturnType<typeof createCheckoutService>;
