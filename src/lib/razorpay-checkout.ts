// Razorpay Standard Checkout in the browser. Only the public key id and the server-created
// Razorpay order id are used here; the result is sent to our server, which verifies the
// signature and confirms the payment with Razorpay before the order is marked paid.
import type { CheckoutPayment, RazorpaySuccess } from "@/services/shopService";

const SRC = "https://checkout.razorpay.com/v1/checkout.js";
type RazorpayCtor = new (o: Record<string, unknown>) => { open(): void; on(ev: string, fn: (r: { error?: { description?: string; metadata?: { payment_id?: string } } }) => void): void };

let loading: Promise<RazorpayCtor> | null = null;
export function loadRazorpay(): Promise<RazorpayCtor> {
  const w = window as unknown as { Razorpay?: RazorpayCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  loading ??= new Promise<RazorpayCtor>((resolve, reject) => {
    const s = Object.assign(document.createElement("script"), { src: SRC, async: true });
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error("Razorpay didn't load.")));
    s.onerror = () => { loading = null; reject(new Error("Couldn't load Razorpay. Check your connection and try again.")); };
    document.head.append(s);
  });
  return loading;
}

export type RazorpayOutcome =
  | { kind: "success"; result: RazorpaySuccess }
  | { kind: "dismissed" }
  | { kind: "failed"; paymentId?: string; reason: string };

/** Opens the Razorpay window and resolves once the shopper pays, or closes it (after a failed attempt or not). */
export async function openRazorpay(p: CheckoutPayment, brand: { name: string; color: string }): Promise<RazorpayOutcome> {
  const Razorpay = await loadRazorpay();
  return new Promise((resolve) => {
    let settled = false;
    // Razorpay lets the shopper retry inside its window, so a failure is only reported if they then close it.
    let lastFailure: { reason: string; paymentId?: string } | null = null;
    const done = (o: RazorpayOutcome) => { if (!settled) { settled = true; resolve(o); } };
    const rzp = new Razorpay({
      key: p.keyId, order_id: p.razorpayOrderId, amount: p.amountPaise, currency: p.currency,
      name: brand.name, description: p.description, prefill: p.prefill, theme: { color: brand.color },
      handler: (r: RazorpaySuccess) => done({ kind: "success", result: r }),
      modal: { ondismiss: () => done(lastFailure ? { kind: "failed", ...lastFailure } : { kind: "dismissed" }), confirm_close: true },
      retry: { enabled: true },
    });
    rzp.on("payment.failed", (r) => {
      lastFailure = { reason: r.error?.description ?? "Payment failed", ...(r.error?.metadata?.payment_id ? { paymentId: r.error.metadata.payment_id } : {}) };
    });
    rzp.open();
  });
}
