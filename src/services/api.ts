// Hostinger backend readiness. Every service in src/services keeps the same function
// signatures it will have when it calls this API, so admin screens don't change.
// Nothing here is connected yet.

/** e.g. "https://api.beingyoualways.com" once the Hostinger backend is live. */
export const HOSTINGER_API_BASE_URL: string | null = null;

/** Planned endpoints (all admin routes need a server-verified owner/admin session). */
export const API_ENDPOINTS = {
  products: "/api/products",               // GET list, POST create (admin)
  product: "/api/products/:id",            // GET, PUT, DELETE (admin)
  productMedia: "/api/products/:id/media", // POST upload, PUT order (admin)
  categories: "/api/categories",
  orders: "/api/admin/orders",             // GET list/filter, POST demo/manual order
  order: "/api/admin/orders/:id",          // GET, PATCH status, POST notes
  customers: "/api/admin/customers",
  customer: "/api/admin/customers/:id",
  reviews: "/api/admin/reviews",           // CRUD + consent / verified / publish
  media: "/api/admin/media",               // video + photo uploads
  campaigns: "/api/admin/whatsapp/campaigns",
  abandonedCart: "/api/admin/whatsapp/abandoned-cart",
  chatbot: "/api/admin/whatsapp/chatbot",
  settings: "/api/admin/settings",
  discounts: "/api/admin/discounts",
  discountCheck: "/api/discounts/validate",
  content: "/api/admin/content",
  adminLogin: "/api/admin/login",
  adminMe: "/api/admin/me",
} as const;

export class BackendNotConnectedError extends Error {
  constructor() { super("The Hostinger backend is not connected yet."); }
}

/**
 * Single place for future API calls. Sends cookies (httpOnly session set by the server);
 * no tokens or secrets are ever stored in the browser.
 */
export async function apiRequest<T>(path: string, init: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown } = {}): Promise<T> {
  if (!HOSTINGER_API_BASE_URL) throw new BackendNotConnectedError();
  const req: RequestInit = { method: init.method ?? "GET", credentials: "include" };
  if (init.body !== undefined) { req.headers = { "Content-Type": "application/json" }; req.body = JSON.stringify(init.body); }
  const res = await fetch(`${HOSTINGER_API_BASE_URL}${path}`, req);
  if (res.status === 401 || res.status === 403) throw new Error("You don't have permission to do that.");
  if (!res.ok) throw new Error(`Server error (${res.status}).`);
  return (await res.json()) as T;
}
