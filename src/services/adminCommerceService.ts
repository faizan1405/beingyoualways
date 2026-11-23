// Admin orders, customers, dashboard, discounts and settings on the Hostinger server.
// Every figure comes from MySQL; every change is permission-checked and logged on the server.
import { API_ENDPOINTS, apiDownload, apiRequest, toQuery, withId } from "./api";
import type { OrderStatusKey, PaymentStatusKey, ServerTotals } from "./shopService";

export type Method = "COD" | "RAZORPAY";
export interface AdminOrderSummary {
  id: string; orderNumber: string; createdAt: string; customerId: string | null; customerName: string; email: string | null; phone: string | null;
  status: OrderStatusKey; paymentMethod: Method; paymentStatus: PaymentStatusKey; totals: ServerTotals; itemCount: number; city: string; isTest: boolean;
}
export interface AdminOrderDetail extends AdminOrderSummary {
  items: { productId: string | null; variantId: string | null; name: string; variantLabel: string; unitPaise: number; quantity: number; lineTotalPaise: number }[];
  shippingAddress: { name: string; phone: string; line1: string; line2: string; city: string; state: string; pincode: string; type: string };
  discountCode: string | null; stockState: string; payBy: string | null; paidAt: string | null;
  shipment: { carrier: string | null; trackingNumber: string | null; trackingUrl: string | null; shippedAt: string | null; deliveredAt: string | null };
  cancelledAt: string | null; cancelReason: string | null;
  payments: { id: string; method: Method; status: string; amountPaise: number; providerOrderId: string | null; providerPaymentId: string | null; providerMethod: string | null; signatureVerified: boolean; capturedAt: string | null; failureReason: string | null; isTest: boolean; recordedBy: string | null; reference: string | null }[];
  timeline: { id: string; at: string; type: string; message: string; note: string | null; by: string | null }[];
  paymentEvents: { id: string; eventType: string; source: string; signatureValid: boolean; outcome: string; amountPaise: number | null; providerPaymentId: string | null; createdAt: string }[];
  allowedNext: OrderStatusKey[]; canCancel: boolean; canRecordCod: boolean;
}
export interface OrderFilters { q?: string; status?: OrderStatusKey | ""; paymentStatus?: PaymentStatusKey | ""; method?: Method | ""; from?: string; to?: string; includeTest?: boolean; page?: number }

export interface AdminCustomer { id: string; name: string; email: string | null; phone: string | null; status: "ACTIVE" | "BLOCKED"; createdAt: string; orderCount: number; paidSpendPaise: number; codOutstandingPaise: number; lastOrderAt: string | null }
export interface AdminCustomerDetail extends AdminCustomer {
  notes: string;
  addresses: { id: string; label: string; name: string; phone: string; line1: string; line2: string | null; city: string; state: string; pincode: string }[];
  orders: { id: string; orderNumber: string; createdAt: string; status: OrderStatusKey; paymentMethod: Method; paymentStatus: PaymentStatusKey; totalPaise: number; isTest: boolean }[];
}

export interface Dashboard {
  range: { from: string; to: string }; includeTest: boolean; revenuePaise: number; paidOrders: number; codOutstandingPaise: number; codOutstandingOrders: number;
  orderCount: number; awaitingPayment: number; testOrders: number; byStatus: Partial<Record<OrderStatusKey, number>>;
  payments: { method: Method; status: PaymentStatusKey; orders: number; amountPaise: number }[];
  topProducts: { productId: string | null; name: string; quantity: number; salesPaise: number }[];
  series: { day: string; orders: number; paidPaise: number }[];
}

export interface AdminDiscount {
  id: string; code: string; description: string; type: "PERCENT" | "FIXED"; percentOff: number | null; amountOffPaise: number | null;
  minOrderPaise: number | null; maxDiscountPaise: number | null; startsAt: string | null; endsAt: string | null; usageLimit: number | null; usedCount: number; active: boolean;
  productIds: string[] | null; categorySlugs: string[] | null; createdAt: string; updatedAt: string;
}
export type DiscountInput = Omit<AdminDiscount, "id" | "usedCount" | "createdAt" | "updatedAt">;

type Regions<M> = { mode: M; states: string[]; pincodePrefixes: string[] };
export interface ShippingSettings { enabled: boolean; flatFeePaise: number | null; freeAbovePaise: number | null; regions: Regions<"all_india" | "states" | "pincodes">; estimateMinDays: number | null; estimateMaxDays: number | null; estimateNote: string; maxQtyPerLine: number }
export interface CodSettings { enabled: boolean; feePaise: number | null; minOrderPaise: number | null; maxOrderPaise: number | null; regions: Regions<"all_shipping" | "states" | "pincodes"> }
export interface StoreContact { contactEmail: string; contactPhone: string; supportNote: string }
export interface AllSettings {
  shipping: ShippingSettings; cod: CodSettings; store: StoreContact;
  readiness: { shipping: string[]; cod: string[]; razorpay: { configured: boolean; mode: "test" | "live" | null; webhookSecretSet: boolean; keyId: string | null }; storeTestMode: boolean };
}

const q = (f: OrderFilters) => toQuery({ q: f.q, status: f.status, paymentStatus: f.paymentStatus, method: f.method, from: f.from, to: f.to, includeTest: f.includeTest ? "true" : undefined, page: f.page });
const post = <T,>(path: string, body: unknown, method: "POST" | "PUT" | "PATCH" = "POST") => apiRequest<T>(path, { method, body });

export const adminCommerce = {
  dashboard: (r: { from?: string; to?: string; includeTest?: boolean }) => apiRequest<Dashboard>(API_ENDPOINTS.dashboard + toQuery({ from: r.from, to: r.to, includeTest: r.includeTest ? "true" : undefined })),
  orders: (f: OrderFilters) => apiRequest<{ orders: AdminOrderSummary[]; total: number; page: number; pageSize: number }>(API_ENDPOINTS.orders + q(f)),
  exportOrders: (f: OrderFilters) => apiDownload(API_ENDPOINTS.ordersCsv + q(f), `orders-${new Date().toISOString().slice(0, 10)}.csv`),
  order: async (id: string) => (await apiRequest<{ order: AdminOrderDetail }>(withId(API_ENDPOINTS.order, id))).order,
  setStatus: async (id: string, to: OrderStatusKey, extra: { note?: string; restock?: boolean } = {}) => (await post<{ order: AdminOrderDetail }>(`${withId(API_ENDPOINTS.order, id)}/status`, { to, ...extra })).order,
  addNote: async (id: string, text: string) => (await post<{ order: AdminOrderDetail }>(`${withId(API_ENDPOINTS.order, id)}/notes`, { text })).order,
  setShipment: async (id: string, s: { carrier: string; trackingNumber: string; trackingUrl: string }) => (await post<{ order: AdminOrderDetail }>(`${withId(API_ENDPOINTS.order, id)}/shipment`, s)).order,
  cancel: async (id: string, reason: string) => (await post<{ order: AdminOrderDetail }>(`${withId(API_ENDPOINTS.order, id)}/cancel`, { reason })).order,
  recordCod: async (id: string, b: { amountPaise: number; reference: string; note?: string }) => (await post<{ order: AdminOrderDetail }>(`${withId(API_ENDPOINTS.order, id)}/cod-collected`, b)).order,
  reconcile: () => post<{ checked: number; paid: number; expired: number }>(API_ENDPOINTS.paymentsReconcile, {}),
  customers: (f: { q?: string; status?: string }) => apiRequest<{ customers: AdminCustomer[] }>(API_ENDPOINTS.customers + toQuery({ q: f.q, status: f.status })),
  customer: async (id: string) => (await apiRequest<{ customer: AdminCustomerDetail }>(withId(API_ENDPOINTS.customer, id))).customer,
  updateCustomer: async (id: string, b: { notes?: string; status?: "ACTIVE" | "BLOCKED" }) => (await post<{ customer: AdminCustomerDetail }>(withId(API_ENDPOINTS.customer, id), b, "PATCH")).customer,
  discounts: async () => (await apiRequest<{ discounts: AdminDiscount[] }>(API_ENDPOINTS.discounts)).discounts,
  createDiscount: async (d: DiscountInput) => (await post<{ discount: AdminDiscount }>(API_ENDPOINTS.discounts, d)).discount,
  updateDiscount: async (id: string, d: DiscountInput) => (await post<{ discount: AdminDiscount }>(withId(API_ENDPOINTS.discount, id), d, "PATCH")).discount,
  deleteDiscount: (id: string) => apiRequest<{ deleted: boolean }>(withId(API_ENDPOINTS.discount, id), { method: "DELETE" }),
  settings: () => apiRequest<AllSettings>(API_ENDPOINTS.settings),
  saveSettings: (kind: "shipping" | "cod" | "store", value: unknown) => post<AllSettings>(withId(API_ENDPOINTS.settingsSection, kind), value, "PUT"),
};

/** Rupees typed by staff → integer paise (blank stays null). */
export const rupeesToPaise = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
};
export const paiseToRupeesText = (p: number | null) => (p == null ? "" : String(p / 100));
