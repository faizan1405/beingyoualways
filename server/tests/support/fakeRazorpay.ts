// Test double for Razorpay's servers (orders, payments, capture). Signatures use the REAL
// verification code from src/services/razorpay.ts with test secrets, so signature checks are exercised for real.
import type { GatewayPayment, PaymentGateway } from "../../src/services/razorpay.js";
import { hmacHex, safeEqualHex } from "../../src/services/razorpay.js";

export const KEY_SECRET = "test_key_secret_for_fake_gateway";
export const WEBHOOK_SECRET = "test_webhook_secret_for_fake_gateway";

export function createFakeRazorpay() {
  let n = 0;
  const orders = new Map<string, { id: string; amountPaise: number; payments: GatewayPayment[] }>();
  const id = (prefix: string) => `${prefix}_FAKE${String(++n).padStart(8, "0")}`;
  const allPayments = () => [...orders.values()].flatMap((o) => o.payments);
  let failCreate = false;

  const gateway: PaymentGateway = {
    mode: "test",
    keyId: "rzp_test_FAKEKEY",
    async createOrder({ amountPaise }) {
      if (failCreate) throw new Error("Razorpay unreachable (simulated)");
      const o = { id: id("order"), amountPaise, payments: [] };
      orders.set(o.id, o);
      return { id: o.id, amountPaise, currency: "INR", receipt: null };
    },
    async fetchPayment(paymentId) {
      const p = allPayments().find((x) => x.id === paymentId);
      if (!p) throw new Error("payment not found");
      return { ...p };
    },
    async fetchOrderPayments(orderId) { return (orders.get(orderId)?.payments ?? []).map((p) => ({ ...p })); },
    async capture(paymentId, amountPaise) {
      const p = allPayments().find((x) => x.id === paymentId);
      if (!p || p.amountPaise !== amountPaise) throw new Error("capture refused");
      p.status = "captured";
      return { ...p };
    },
    verifyCheckoutSignature: (o, p, sig) => safeEqualHex(hmacHex(KEY_SECRET, `${o}|${p}`), sig),
    verifyWebhookSignature: (raw, sig) => safeEqualHex(hmacHex(WEBHOOK_SECRET, raw), sig),
  };

  return {
    gateway,
    orders,
    setCreateFails(v: boolean) { failCreate = v; },
    /** Shopper completes (or fails) a payment in the Razorpay window. Returns what Checkout hands the browser. */
    pay(orderId: string, opts: { status?: GatewayPayment["status"]; amountPaise?: number; method?: string } = {}) {
      const o = orders.get(orderId);
      if (!o) throw new Error("unknown order");
      const p: GatewayPayment = { id: id("pay"), orderId, amountPaise: opts.amountPaise ?? o.amountPaise, currency: "INR", status: opts.status ?? "captured", method: opts.method ?? "upi", errorDescription: opts.status === "failed" ? "Payment declined by bank (simulated)" : null, amountRefundedPaise: 0 };
      o.payments.push(p);
      return { payment: p, checkout: { razorpay_order_id: orderId, razorpay_payment_id: p.id, razorpay_signature: hmacHex(KEY_SECRET, `${orderId}|${p.id}`) } };
    },
    /** Staff refund in the Razorpay dashboard, and the refund.processed webhook it triggers (refund entity only, as Razorpay sends it). */
    refund(p: GatewayPayment, amountPaise: number) {
      const stored = allPayments().find((x) => x.id === p.id)!;
      stored.amountRefundedPaise += amountPaise;
      if (stored.amountRefundedPaise >= stored.amountPaise) stored.status = "refunded";
      const body = { entity: "event", event: "refund.processed", payload: { refund: { entity: { id: id("rfnd"), payment_id: p.id, amount: amountPaise, currency: "INR", status: "processed" } } }, created_at: Math.floor(Date.now() / 1000) };
      const raw = Buffer.from(JSON.stringify(body));
      return { raw, signature: hmacHex(WEBHOOK_SECRET, raw), eventId: id("evt") };
    },
    /** A webhook exactly as Razorpay would send it (raw body + signature header). */
    webhook(event: string, p: GatewayPayment, extra: Record<string, unknown> = {}) {
      const body = { entity: "event", event, payload: { payment: { entity: { id: p.id, order_id: p.orderId, amount: p.amountPaise, currency: p.currency, status: p.status, method: p.method, error_description: p.errorDescription, ...extra } } }, created_at: Math.floor(Date.now() / 1000) };
      const raw = Buffer.from(JSON.stringify(body));
      return { raw, signature: hmacHex(WEBHOOK_SECRET, raw), eventId: id("evt") };
    },
  };
}
