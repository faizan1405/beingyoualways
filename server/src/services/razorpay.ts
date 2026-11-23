import { createHmac, timingSafeEqual } from "node:crypto";

import Razorpay from "razorpay";

import type { Config } from "../config.js";

// Razorpay Standard Checkout, server side. The key secret and webhook secret never leave the server.

export type GatewayPaymentStatus = "created" | "authorized" | "captured" | "refunded" | "failed";
export interface GatewayPayment {
  id: string;
  orderId: string | null;
  amountPaise: number;
  currency: string;
  status: GatewayPaymentStatus;
  method: string | null;
  errorDescription: string | null;
  /** total refunded so far, in paise (0 when nothing was refunded) */
  amountRefundedPaise: number;
}
export interface GatewayOrder { id: string; amountPaise: number; currency: string; receipt: string | null }

export interface PaymentGateway {
  mode: "test" | "live";
  keyId: string;
  createOrder(input: { amountPaise: number; receipt: string; notes: Record<string, string> }): Promise<GatewayOrder>;
  fetchPayment(paymentId: string): Promise<GatewayPayment>;
  fetchOrderPayments(orderId: string): Promise<GatewayPayment[]>;
  capture(paymentId: string, amountPaise: number): Promise<GatewayPayment>;
  /** Checkout handler signature: HMAC-SHA256(order_id|payment_id, key secret). */
  verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean;
  /** Webhook signature: HMAC-SHA256(raw request body, webhook secret). */
  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean;
}

export function safeEqualHex(expectedHex: string, given: string | undefined): boolean {
  if (!given || !/^[a-f0-9]+$/i.test(given)) return false;
  const a = Buffer.from(expectedHex, "hex");
  const b = Buffer.from(given, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
export const hmacHex = (secret: string, data: string | Buffer) => createHmac("sha256", secret).update(data).digest("hex");

type RawPayment = { id: string; order_id?: string | null; amount: number | string; currency: string; status: string; method?: string | null; error_description?: string | null; amount_refunded?: number | string | null };
export const toGatewayPayment = (p: RawPayment): GatewayPayment => ({
  id: p.id,
  orderId: p.order_id ?? null,
  amountPaise: Number(p.amount),
  currency: p.currency,
  status: (["created", "authorized", "captured", "refunded", "failed"].includes(p.status) ? p.status : "created") as GatewayPaymentStatus,
  method: p.method ?? null,
  errorDescription: p.error_description ?? null,
  amountRefundedPaise: Number(p.amount_refunded ?? 0) || 0,
});

/** Official Razorpay Node.js SDK. Returns null while no keys are configured (online payment stays off). */
export function createRazorpayGateway(config: Config): PaymentGateway | null {
  const rp = config.razorpay;
  if (!rp) return null;
  const client = new Razorpay({ key_id: rp.keyId, key_secret: rp.keySecret });
  return {
    mode: rp.mode,
    keyId: rp.keyId,
    async createOrder({ amountPaise, receipt, notes }) {
      const o = await client.orders.create({ amount: amountPaise, currency: "INR", receipt, notes });
      return { id: o.id, amountPaise: Number(o.amount), currency: o.currency, receipt: o.receipt ?? null };
    },
    async fetchPayment(paymentId) {
      return toGatewayPayment((await client.payments.fetch(paymentId)) as unknown as RawPayment);
    },
    async fetchOrderPayments(orderId) {
      const r = (await client.orders.fetchPayments(orderId)) as unknown as { items: RawPayment[] };
      return r.items.map(toGatewayPayment);
    },
    async capture(paymentId, amountPaise) {
      return toGatewayPayment((await client.payments.capture(paymentId, amountPaise, "INR")) as unknown as RawPayment);
    },
    verifyCheckoutSignature: (orderId, paymentId, signature) => safeEqualHex(hmacHex(rp.keySecret, `${orderId}|${paymentId}`), signature),
    verifyWebhookSignature: (rawBody, signature) => safeEqualHex(hmacHex(rp.webhookSecret, rawBody), signature),
  };
}
