// Shop checkout against the Hostinger server. Every price, total, stock check, discount and payment
// decision is made on the server — the browser only sends what the shopper chose.
import type { OrderSummary } from "@/lib/types";
import { API_ENDPOINTS, apiRequest, isBackendConfigured } from "./api";

export interface ServerTotals { subtotalPaise: number; discountPaise: number; shippingPaise: number; codFeePaise: number; totalPaise: number }
export type LineStatus = "ok" | "unavailable" | "sold_out" | "insufficient_stock" | "limit";
export interface QuoteLine {
  productId: string; variantId: string; name: string; variantLabel: string; quantity: number; unitPaise: number; lineTotalPaise: number;
  status: LineStatus; message: string | null; priceChanged: { fromPaise: number; toPaise: number } | null;
}
export interface Quote {
  lines: QuoteLine[];
  totals: ServerTotals | null;
  discount: { code: string; ok: boolean; amountPaise: number; message: string | null } | null;
  shipping: { configured: boolean; deliverable: boolean };
  methods: { cod: { available: boolean; feePaise: number | null; reason: string | null }; razorpay: { available: boolean; testMode: boolean; reason: string | null } };
  blockers: { code: string; message: string }[];
  canPlaceOrder: boolean;
}
export interface CheckoutConfig {
  shipping: { configured: boolean; flatFeePaise: number | null; freeAbovePaise: number | null; estimate: string | null; estimateNote: string; limitedRegions: boolean; maxQtyPerLine: number };
  cod: { available: boolean; feePaise: number | null; minOrderPaise: number | null; maxOrderPaise: number | null; limitedRegions: boolean };
  razorpay: { available: boolean; testMode: boolean };
  store: { contactEmail: string; contactPhone: string };
  testMode: boolean;
}
export type OrderStatusKey = "PENDING_PAYMENT" | "NEW" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED";
export type PaymentStatusKey = "PENDING" | "COD_PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";
export interface PublicOrder {
  orderNumber: string; createdAt: string; status: OrderStatusKey; statusLabel: string; paymentMethod: "cod" | "razorpay"; paymentStatus: PaymentStatusKey;
  items: { productId: string | null; variantId: string | null; name: string; variantLabel: string; unitPaise: number; quantity: number; lineTotalPaise: number }[];
  totals: ServerTotals; discountCode: string | null; shipTo: { name: string; city: string; state: string; pincode: string };
  payBy: string | null; isTest: boolean; shipment: { carrier: string | null; trackingNumber: string; trackingUrl: string | null } | null;
}
export interface CheckoutPayment {
  provider: "razorpay"; keyId: string; razorpayOrderId: string; amountPaise: number; currency: "INR"; description: string;
  prefill: { name: string; email: string; contact: string }; testMode: boolean;
}
export interface OrderResult { order: PublicOrder; accessToken: string; payment: CheckoutPayment | null; duplicate?: boolean; paymentStartFailed?: boolean }

export interface CheckoutLine { productId: string; variantId: string; quantity: number; seenUnitPrice?: number }
export interface PlaceOrderInput {
  checkoutKey: string; lines: CheckoutLine[];
  contact: { name: string; email: string; phone: string };
  address: { line1: string; line2: string; city: string; state: string; pincode: string; type: "home" | "work" | "other" };
  paymentMethod: "cod" | "razorpay"; discountCode?: string;
}
export interface RazorpaySuccess { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
type Access = { orderNumber: string; token: string };

const post = <T,>(path: string, body: unknown) => apiRequest<T>(path, { method: "POST", body });

export const shopService = {
  isLive: isBackendConfigured,
  config: () => apiRequest<CheckoutConfig>(API_ENDPOINTS.checkoutConfig),
  quote: (input: { lines: CheckoutLine[]; destination?: { state: string; pincode: string }; paymentMethod?: "cod" | "razorpay"; discountCode?: string }) => post<Quote>(API_ENDPOINTS.checkoutQuote, input),
  placeOrder: (input: PlaceOrderInput) => post<OrderResult>(API_ENDPOINTS.checkoutOrders, input),
  lookup: (a: Access) => post<OrderResult>(API_ENDPOINTS.checkoutLookup, a),
  retryPayment: (a: Access) => post<OrderResult>(API_ENDPOINTS.checkoutRetry, a),
  verifyRazorpay: (a: Access, r: RazorpaySuccess) => post<OrderResult>(API_ENDPOINTS.razorpayVerify, { ...a, ...r }),
  reportProblem: (a: Access, p: { kind: "cancelled" | "failed"; razorpay_payment_id?: string; reason?: string }) => post<OrderResult>(API_ENDPOINTS.razorpayProblem, { ...a, ...p }),
};

/** Server totals in the shape the shared OrderTotals block shows (rupees). */
export function summaryFromServer(t: ServerTotals, itemCount: number): OrderSummary {
  return {
    subtotal: t.subtotalPaise / 100, discount: t.discountPaise / 100,
    shipping: t.shippingPaise === 0 ? { state: "free" } : { state: "charged", amount: t.shippingPaise / 100 },
    total: t.totalPaise / 100, itemCount, ...(t.codFeePaise > 0 ? { codFee: t.codFeePaise / 100 } : {}),
  };
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatusKey, string> = {
  PENDING: "Waiting for payment", COD_PENDING: "Cash on Delivery — pay when it arrives", PAID: "Paid", FAILED: "Payment not completed", CANCELLED: "Cancelled", REFUNDED: "Refunded",
};
