// Admin access (DEMO). There is NO real authentication in this prototype: the
// "demo mode" flag below is a convenience gate, not security — anyone can open the
// admin. Production administration must stay disabled until the Hostinger backend
// verifies sign-in on the server and checks roles on every protected API route.

export type AdminRole = "owner" | "admin" | "staff";
export type AdminArea = "dashboard" | "products" | "orders" | "customers" | "stories" | "marketing" | "content" | "discounts" | "settings" | "approvals" | "data";

/** Planned permissions — to be enforced by the backend, mirrored here only to shape the UI. */
export const ROLE_PERMISSIONS: Record<AdminRole, AdminArea[]> = {
  owner: ["dashboard", "products", "orders", "customers", "stories", "marketing", "content", "discounts", "settings", "approvals", "data"],
  admin: ["dashboard", "products", "orders", "customers", "stories", "marketing", "content", "discounts", "approvals"],
  staff: ["dashboard", "orders", "customers"],
};
export const can = (role: AdminRole, area: AdminArea) => ROLE_PERMISSIONS[role].includes(area);

/** Set when the Hostinger backend exposes POST /api/admin/login (returns an httpOnly session cookie). */
export const ADMIN_LOGIN_ENDPOINT: string | null = null;
export const ADMIN_AUTH_SECURE = false as const;

export interface AdminSession { mode: "demo"; role: AdminRole; since: string }
const KEY = "bya.admin.demo-session";

export type AdminSignInResult = { ok: false; reason: "backend-required" | "invalid" };

export const adminAuthService = {
  current: (): AdminSession | null => {
    if (typeof window === "undefined") return null;
    try { const v = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as AdminSession | null; return v?.mode === "demo" ? v : null; } catch { return null; }
  },
  /** Real sign-in — needs the backend. Never accepts a password in the browser. */
  signIn: async (email: string, password: string): Promise<AdminSignInResult> => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) return { ok: false, reason: "invalid" };
    return { ok: false, reason: "backend-required" };
  },
  /** Opens the prototype admin for this tab only. Not a login. */
  enterDemo: (): AdminSession => {
    const s: AdminSession = { mode: "demo", role: "owner", since: new Date().toISOString() };
    sessionStorage.setItem(KEY, JSON.stringify(s));
    return s;
  },
  signOut: () => { if (typeof window !== "undefined") sessionStorage.removeItem(KEY); },
};
