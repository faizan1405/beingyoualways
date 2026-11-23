// Order → WhatsApp updates. Called inside the order's own database transaction, so the queued
// message exists exactly when the status change does; the dedupe key (order + step) means a repeated
// status change, a retried Razorpay webhook or a double click never sends the same update twice.
import type { Prisma } from "@prisma/client";

import type { Config } from "../config.js";
import type { PlaceOrderInput } from "../lib/checkoutSchema.js";
import { formatInr, toPaise } from "../lib/money.js";
import { CONSENT, toWaDigits, type OrderPurpose } from "../lib/whatsapp.js";
import { orderToken } from "./orderLinks.js";
import type { WhatsAppService } from "./whatsappService.js";

type Tx = Prisma.TransactionClient;

export interface OrderHooks {
  /** queue the customer's update for this step (inside the caller's transaction) */
  orderEvent(tx: Tx, orderId: string, purpose: OrderPurpose): Promise<void>;
  /** checkout finished: consent choices, bag reminders cancelled, COD confirmation queued */
  orderPlaced(tx: Tx, order: { id: string; phone: string | null; customerId: string | null; paymentMethod: string }, input: PlaceOrderInput): Promise<void>;
  /** after commit: wake the sender */
  kick(): void;
}

export const firstName = (full: string) => full.trim().split(/\s+/)[0] || "there";

export function createOrderHooks(wa: WhatsAppService, config: Config): OrderHooks {
  const link = (orderNumber: string) => `${config.publicSiteUrl}/order/${encodeURIComponent(orderNumber)}#t=${orderToken(config.orderLinkSecret, orderNumber)}`;

  function values(purpose: OrderPurpose, o: { orderNumber: string; customerName: string; grandTotal: Prisma.Decimal }): string[] {
    const name = firstName(o.customerName), total = formatInr(toPaise(o.grandTotal));
    switch (purpose) {
      case "order_confirmation": return [name, o.orderNumber, total];
      case "payment_confirmation": return [name, total, o.orderNumber];
      case "cod_order_confirmation": return [name, o.orderNumber, total];
      case "order_shipped": return [name, o.orderNumber, link(o.orderNumber)];
      default: return [name, o.orderNumber];
    }
  }

  async function orderEvent(tx: Tx, orderId: string, purpose: OrderPurpose) {
    if (!wa.configured) return;
    if (!(await wa.automations()).orderUpdates) return;
    const o = await tx.order.findUnique({ where: { id: orderId }, select: { id: true, orderNumber: true, customerName: true, grandTotal: true, phone: true, customerId: true } });
    const phone = toWaDigits(o?.phone);
    if (!o || !phone) return;
    const consent = await wa.latestConsent(tx, phone, CONSENT.orderUpdates);
    await wa.enqueue(tx, {
      kind: "order", purpose, dedupeKey: `order:${o.id}:${purpose}`, phone, customerId: o.customerId, orderId: o.id,
      values: { body: values(purpose, o) },
      ...(consent !== "OPTED_IN" ? { skipReason: "Not sent: the customer hasn't agreed to WhatsApp order updates." } : {}),
    });
  }

  return {
    orderEvent,
    async orderPlaced(tx, order, input) {
      const phone = toWaDigits(order.phone);
      if (phone) {
        if (input.whatsapp?.orderUpdates) await wa.recordConsent(tx, { phone, purpose: CONSENT.orderUpdates, status: "OPTED_IN", source: "checkout", customerId: order.customerId });
        if (input.whatsapp?.offers) await wa.recordConsent(tx, { phone, purpose: CONSENT.marketing, status: "OPTED_IN", source: "checkout", customerId: order.customerId });
        // the shopper finished: no bag reminder for this checkout (or another open one from the same number)
        await tx.abandonedCheckout.updateMany({ where: { OR: [{ checkoutKey: input.checkoutKey }, { phone }], status: "OPEN" }, data: { status: "CONVERTED", orderId: order.id } });
        await tx.abandonedCheckout.updateMany({ where: { checkoutKey: input.checkoutKey, status: "REMINDED", orderId: null }, data: { status: "CONVERTED", orderId: order.id } });
      }
      if (order.paymentMethod === "COD") await orderEvent(tx, order.id, "cod_order_confirmation");
    },
    kick: () => wa.kick(),
  };
}
