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
  // ── Later phases (not on the server yet) ──
  productMedia: "/api/admin/products/:id/media",
  orders: "/api/admin/orders",
  order: "/api/admin/orders/:id",
  customers: "/api/admin/customers",
  customer: "/api/admin/customers/:id",
  reviews: "/api/admin/reviews",
  media: "/api/admin/media",
  campaigns: "/api/admin/whatsapp/campaigns",
  abandonedCart: "/api/admin/whatsapp/abandoned-cart",
  chatbot: "/api/admin/whatsapp/chatbot",
  settings: "/api/admin/settings",
  discounts: "/api/admin/discounts",
  discountCheck: "/api/discounts/validate",
  content: "/api/admin/content",
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

/** Admin areas that read and write the real database in Phase 1. Every other admin area stays disabled when connected. */
export const LIVE_ADMIN_PATHS = ["/admin/products"] as const;
export const isLiveAdminPath = (pathname: string) => LIVE_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export class BackendNotConnectedError extends Error {
  constructor() { super("The Hostinger backend is not connected yet."); }
}

/** The server couldn't be reached (offline, DNS, CORS or server down). Nothing was saved. */
export class BackendOfflineError extends Error {
  constructor() { super("Can't reach the store server right now. Nothing was saved — check the connection and try again."); }
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: { field: string; message: string }[]) { super(message); }
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
  let body: { error?: { code?: string; message?: string; details?: { field: string; message: string }[] } } = {};
  try { body = await res.json(); } catch { /* not JSON (e.g. a proxy error page) */ }
  const e = body.error;
  if (res.status === 401) throw new ApiError(401, e?.code ?? "unauthorized", e?.code === "invalid_credentials" ? e.message ?? "Email or password is incorrect." : "Your admin session has ended — please sign in again.");
  if (res.status === 403) throw new ApiError(403, e?.code ?? "forbidden", e?.message ?? "You don't have permission to do that.");
  const detail = e?.details?.length ? ` (${e.details.map((d) => `${d.field}: ${d.message}`).join("; ")})` : "";
  throw new ApiError(res.status, e?.code ?? "server_error", (e?.message ?? (res.status >= 500 ? "The store server had a problem. Nothing was saved." : `Request failed (${res.status}).`)) + detail, e?.details);
}

/** Path with :id filled in (URL-encoded). */
export const withId = (path: string, id: string) => path.replace(":id", encodeURIComponent(id));
