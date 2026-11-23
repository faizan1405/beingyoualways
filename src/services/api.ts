// Hostinger backend connection. Every service in src/services keeps the same function
// signatures whether it uses the browser demo store or this API, so screens don't change.
//
// Set VITE_API_BASE_URL (e.g. "https://api.beingyoualways.com") in the production build to
// switch the shop and admin to the real database. While it is empty (this preview) the site
// runs in clearly-labelled demo mode. No URL is hard-coded here.

const rawBase = (import.meta.env["VITE_API_BASE_URL"] as string | undefined)?.trim() ?? "";

/** Normalised API origin, or null while no backend is configured. Only absolute http(s) URLs are accepted. */
export const parseApiBaseUrl = (raw: string): string | null => (/^https?:\/\/[^\s/]+(\/[^\s]*)?$/.test(raw) ? raw.replace(/\/+$/, "") : null);

export const HOSTINGER_API_BASE_URL: string | null = parseApiBaseUrl(rawBase);

/** Endpoints. Phase 1 (live on the server): health, auth, products, categories, admin products. Others are later phases. */
export const API_ENDPOINTS = {
  health: "/api/health",
  adminLogin: "/api/auth/login",           // POST { email, password } → httpOnly session cookie
  adminLogout: "/api/auth/logout",         // POST — ends the session on the server
  adminMe: "/api/auth/me",                 // GET current admin (401 when signed out)
  products: "/api/products",               // GET active products
  product: "/api/products/:id",            // GET one active product by id or web address
  categories: "/api/categories",
  adminProducts: "/api/admin/products",    // GET all (incl. hidden), POST create
  adminProduct: "/api/admin/products/:id", // GET, PATCH, DELETE (archive; ?permanent=true for unused drafts)
  // ── Phase 2 (live on the server): shop checkout + admin orders, customers, dashboard, discounts, settings ──
  checkoutConfig: "/api/checkout/config",              // GET shipping / COD / online-payment availability (no secrets)
  checkoutQuote: "/api/checkout/quote",                // POST bag → database prices, stock, discount, totals in paise
  checkoutOrders: "/api/checkout/orders",              // POST place order (checkoutKey makes repeats safe)
  checkoutLookup: "/api/checkout/orders/lookup",       // POST { orderNumber, token } → shopper's order status
  checkoutRetry: "/api/checkout/orders/retry-payment", // POST reopen Razorpay for the same order
  razorpayVerify: "/api/checkout/razorpay/verify",     // POST Razorpay Checkout result → verified on the server
  razorpayProblem: "/api/checkout/razorpay/problem",   // POST payment window closed / failed (informational)
  razorpayWebhook: "/api/webhooks/razorpay",           // Razorpay → server only (signed)
  dashboard: "/api/admin/dashboard",
  orders: "/api/admin/orders",
  order: "/api/admin/orders/:id",
  ordersCsv: "/api/admin/orders/export.csv",
  paymentsReconcile: "/api/admin/payments/reconcile",
  customers: "/api/admin/customers",
  customer: "/api/admin/customers/:id",
  settings: "/api/admin/settings",
  settingsSection: "/api/admin/settings/:id",          // PUT shipping | cod | store
  discounts: "/api/admin/discounts",
  discount: "/api/admin/discounts/:id",
  // ── Phase 3 (live on the server): shopper accounts, media, stories, website wording, approvals ──
  customerRegister: "/api/customer/register",                  // POST { name, email, password, phone? } → shopper cookie
  customerLogin: "/api/customer/login",                        // POST { email, password }
  customerLogout: "/api/customer/logout",                      // POST — ends this shopper session
  customerMe: "/api/customer/me",                              // GET current shopper (401 when signed out), PATCH profile
  customerVerifyEmail: "/api/customer/verify-email",           // POST { token } from the confirmation email
  customerResendVerification: "/api/customer/resend-verification", // POST
  customerForgotPassword: "/api/customer/forgot-password",     // POST { email } — same answer either way
  customerResetPassword: "/api/customer/reset-password",       // POST { token, password }
  customerChangePassword: "/api/customer/change-password",     // POST { currentPassword, password }
  customerAddresses: "/api/customer/addresses",                // GET list, POST add
  customerAddressDelete: "/api/customer/addresses/:id/delete", // POST
  customerOrders: "/api/customer/orders",                      // GET order history
  customerClaimOrder: "/api/customer/orders/claim",            // POST { orderNumber, token } — token is the private link's key
  googleStatus: "/api/auth/google/status",                     // GET { configured } — never starts a flow by itself
  googleStart: "/api/auth/google/start",                       // GET — full-page redirect into Google's sign-in
  publicReviews: "/api/reviews",                               // GET published, consented customer stories
  publicContent: "/api/content",                               // GET website wording
  media: "/api/admin/media",                                   // GET list, POST /upload (multipart)
  mediaItem: "/api/admin/media/:id",                           // PATCH alt/position, POST /delete (archive) or /purge
  mediaUpload: "/api/admin/media/upload",                      // POST multipart file; kind/productId/reviewId as query
  reviews: "/api/admin/reviews",                               // GET list, POST create
  reviewItem: "/api/admin/reviews/:id",                        // PATCH update, POST /delete
  content: "/api/admin/content",                               // GET all, PUT bulk, POST one key
  contentKey: "/api/admin/content/:id",                        // POST /delete — back to built-in wording
  approvals: "/api/admin/approvals",                           // GET the pre-launch checklist from live data
  // ── Later phases (not on the server yet) ──
  campaigns: "/api/admin/whatsapp/campaigns",
  abandonedCart: "/api/admin/whatsapp/abandoned-cart",
  chatbot: "/api/admin/whatsapp/chatbot",
  // WhatsApp Cloud API (all Meta calls happen on the server with the token from server env)
  otpRequest: "/api/auth/whatsapp/request-otp",       // POST { phone } → { expiresInSeconds, resendInSeconds }
  otpVerify: "/api/auth/whatsapp/verify-otp",         // POST { phone, code } → sets httpOnly session cookie
  waStatus: "/api/admin/whatsapp/status",             // GET token, permissions, number, WABA, tier, quality
  waTemplates: "/api/admin/whatsapp/templates",       // GET approved / pending templates from Meta
  waMessages: "/api/admin/whatsapp/messages",         // GET sent / failed messages with webhook statuses
  waErrors: "/api/admin/whatsapp/errors",             // GET recent Meta API errors
  waTest: "/api/admin/whatsapp/tests",                // POST { check, recipient } — one authorized test number only
  waOrderNotify: "/api/admin/orders/:id/notify",      // POST (also sent automatically on status change)
  waCampaignSchedule: "/api/admin/whatsapp/campaigns/:id/schedule", // POST — admin presses Schedule; never automatic
  waOptOut: "/api/admin/whatsapp/opt-outs",           // GET / POST consent changes ("STOP" replies arrive via webhook)
  waWebhook: "/api/whatsapp/webhook",                 // GET verify handshake, POST Meta events (signature checked)
} as const;

export const isBackendConfigured = () => HOSTINGER_API_BASE_URL !== null;

/**
 * Demo data (sample orders, browser-saved admin edits, demo reset) exists ONLY in the development
 * preview with no store server. A production build never falls back to it: without
 * VITE_API_BASE_URL it shows "store not connected" instead.
 */
export const DEMO_MODE: boolean = !isBackendConfigured() && import.meta.env.DEV;
export const isDemoMode = () => DEMO_MODE;
/** Production build without a store server: browsing works, ordering and admin are switched off. */
export const isUnconnectedProduction = () => !isBackendConfigured() && !DEMO_MODE;

/** Admin areas that read and write the real database. Every other admin area stays disabled when connected. */
export const LIVE_ADMIN_PATHS = ["/admin/products", "/admin/orders", "/admin/customers", "/admin/discounts", "/admin/settings", "/admin/content", "/admin/testimonials", "/admin/approvals"] as const;
export const isLiveAdminPath = (pathname: string) => pathname.replace(/\/$/, "") === "/admin" || LIVE_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export class BackendNotConnectedError extends Error {
  override name = "BackendNotConnectedError";
  constructor() { super("The Hostinger backend is not connected yet."); }
}

/** The server couldn't be reached (offline, DNS, CORS or server down). Nothing was saved. */
export class BackendOfflineError extends Error {
  override name = "BackendOfflineError";
  constructor() { super("Can't reach the store server right now. Nothing was saved — check the connection and try again."); }
}

export class ApiError extends Error {
  override name = "ApiError";
  constructor(public status: number, public code: string, message: string, public details?: { field: string; message: string }[], public data?: unknown) { super(message); }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Single place for API calls. Sends cookies (httpOnly session set by the server);
 * no tokens or secrets are ever stored in the browser. Writes always send JSON,
 * which the server requires as part of its cross-site request protection.
 */
export async function apiRequest<T>(path: string, init: { method?: Method; body?: unknown } = {}): Promise<T> {
  if (!HOSTINGER_API_BASE_URL) throw new BackendNotConnectedError();
  const method = init.method ?? "GET";
  const req: RequestInit = { method, credentials: "include", cache: "no-store", headers: { Accept: "application/json" } };
  if (method !== "GET") { req.headers = { Accept: "application/json", "Content-Type": "application/json" }; req.body = JSON.stringify(init.body ?? {}); }
  let res: Response;
  try {
    res = await fetch(`${HOSTINGER_API_BASE_URL}${path}`, req);
  } catch {
    throw new BackendOfflineError();
  }
  if (res.ok) return (await res.json()) as T;
  let body: { error?: { code?: string; message?: string; details?: unknown } } = {};
  try { body = await res.json(); } catch { /* not JSON (e.g. a proxy error page) */ }
  const e = body.error;
  if (res.status === 401) throw new ApiError(401, e?.code ?? "unauthorized", e?.code === "invalid_credentials" ? e.message ?? "Email or password is incorrect." : "Your admin session has ended — please sign in again.");
  if (res.status === 403) throw new ApiError(403, e?.code ?? "forbidden", e?.message ?? "You don't have permission to do that.");
  const list = Array.isArray(e?.details) ? (e.details as { field: string; message: string }[]) : undefined;
  const detail = list?.length && e?.code === "validation_failed" ? ` (${list.map((d) => `${d.field}: ${d.message}`).join("; ")})` : "";
  throw new ApiError(res.status, e?.code ?? "server_error", (e?.message ?? (res.status >= 500 ? "The store server had a problem. Nothing was saved." : `Request failed (${res.status}).`)) + detail, list, e?.details);
}

/** Path with :id filled in (URL-encoded). */
export const withId = (path: string, id: string) => path.replace(":id", encodeURIComponent(id));

/** Query string from defined values only. */
export const toQuery = (q: Record<string, string | number | boolean | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

/**
 * Authenticated file upload (admin media). Uses XMLHttpRequest because fetch can't report upload
 * progress. The file goes as multipart form data; settings travel as query parameters. The server
 * checks the file's real bytes, never its name.
 */
export function apiUpload<T>(path: string, file: File, query: Record<string, string | number | undefined>, onProgress?: (percent: number) => void): Promise<T> {
  if (!HOSTINGER_API_BASE_URL) return Promise.reject(new BackendNotConnectedError());
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${HOSTINGER_API_BASE_URL}${path}${toQuery(query)}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Accept", "application/json");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let body: { error?: { code?: string; message?: string } } = {};
      try { body = JSON.parse(xhr.responseText) as typeof body; } catch { /* not JSON (e.g. a proxy error page) */ }
      if (xhr.status >= 200 && xhr.status < 300) { resolve(body as T); return; }
      const e = body.error;
      reject(new ApiError(xhr.status, e?.code ?? "server_error", e?.message ?? (xhr.status === 401 ? "Your admin session has ended — please sign in again." : "The upload failed. Nothing was saved.")));
    };
    xhr.onerror = () => reject(new BackendOfflineError());
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

/** Authenticated file download (e.g. the orders CSV) — same cookie rules as apiRequest. */
export async function apiDownload(path: string, filename: string): Promise<void> {
  if (!HOSTINGER_API_BASE_URL) throw new BackendNotConnectedError();
  let res: Response;
  try { res = await fetch(`${HOSTINGER_API_BASE_URL}${path}`, { credentials: "include", cache: "no-store" }); } catch { throw new BackendOfflineError(); }
  if (!res.ok) throw new ApiError(res.status, "download_failed", res.status === 401 ? "Your admin session has ended — please sign in again." : "The export couldn't be created. Nothing was downloaded.");
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
