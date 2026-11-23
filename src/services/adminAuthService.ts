// Admin access.
// - Demo mode (no VITE_API_BASE_URL): the "demo mode" flag below is a convenience gate,
//   NOT security — anyone can open the demo admin, which only touches browser data.
// - Live mode: sign-in is checked by the Hostinger server (Argon2id password hash,
//   httpOnly session cookie, lockout). The browser never stores a token or password;
//   every admin API call is re-checked on the server, so editing browser storage or
//   opening an /admin URL directly gives no access to data.
import { API_ENDPOINTS, ApiError, BackendOfflineError, apiRequest, isBackendConfigured } from "./api";

export type AdminRole = "owner" | "admin" | "staff";
export type AdminArea = "dashboard" | "products" | "orders" | "customers" | "stories" | "marketing" | "content" | "discounts" | "settings" | "approvals" | "data";

/** Area visibility in the admin UI. The server enforces its own permission list on every request. */
export const ROLE_PERMISSIONS: Record<AdminRole, AdminArea[]> = {
  owner: ["dashboard", "products", "orders", "customers", "stories", "marketing", "content", "discounts", "settings", "approvals", "data"],
  admin: ["dashboard", "products", "orders", "customers", "stories", "marketing", "content", "discounts", "approvals"],
  staff: ["dashboard", "orders", "customers"],
};
export const can = (role: AdminRole, area: AdminArea) => ROLE_PERMISSIONS[role].includes(area);

/** True when admin sign-in is verified by the server. */
export const isSecureAdmin = () => isBackendConfigured();

export interface AdminSession {
  mode: "demo" | "server";
  role: AdminRole;
  since: string;
  name?: string | undefined;
  email?: string | undefined;
  /** Server permission keys, e.g. "products.write" (live mode). */
  permissions?: string[] | undefined;
}
const KEY = "bya.admin.demo-session";

export type AdminSignInResult =
  | { ok: true; session: AdminSession }
  | { ok: false; reason: "backend-required" | "invalid" | "locked" | "offline" | "error"; message?: string };

interface ServerUser { id: string; email: string; name: string; roles: string[]; permissions: string[] }
const toSession = (u: ServerUser): AdminSession => ({
  mode: "server",
  role: (["owner", "admin", "staff"] as const).find((r) => u.roles.includes(r)) ?? "staff",
  since: new Date().toISOString(),
  name: u.name,
  email: u.email,
  permissions: u.permissions,
});

// Live mode keeps the signed-in admin in memory only (re-checked with the server on load).
let serverSession: AdminSession | null = null;

export const adminAuthService = {
  /** Synchronous view of the current session (demo flag, or the last server check). */
  current: (): AdminSession | null => {
    if (isBackendConfigured()) return serverSession;
    if (typeof window === "undefined") return null;
    try { const v = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as AdminSession | null; return v?.mode === "demo" ? v : null; } catch { return null; }
  },
  /** Asks the server who is signed in (live), or reads the demo flag. Throws BackendOfflineError when unreachable. */
  check: async (): Promise<AdminSession | null> => {
    if (!isBackendConfigured()) return adminAuthService.current();
    try {
      serverSession = toSession((await apiRequest<{ user: ServerUser }>(API_ENDPOINTS.adminMe)).user);
    } catch (e) {
      serverSession = null;
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
    return serverSession;
  },
  /** Real sign-in — checked by the server. Demo mode never accepts a password. */
  signIn: async (email: string, password: string): Promise<AdminSignInResult> => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) return { ok: false, reason: "invalid", message: "Enter a valid email and your password." };
    if (!isBackendConfigured()) return { ok: false, reason: "backend-required" };
    try {
      const r = await apiRequest<{ user: ServerUser }>(API_ENDPOINTS.adminLogin, { method: "POST", body: { email, password } });
      serverSession = toSession(r.user);
      return { ok: true, session: serverSession };
    } catch (e) {
      if (e instanceof BackendOfflineError) return { ok: false, reason: "offline", message: e.message };
      if (e instanceof ApiError && e.status === 401) return { ok: false, reason: "invalid", message: "Email or password is incorrect." };
      if (e instanceof ApiError && e.status === 429) return { ok: false, reason: "locked", message: e.message };
      return { ok: false, reason: "error", message: e instanceof Error ? e.message : "Sign-in failed." };
    }
  },
  /** Opens the prototype admin for this tab only. Not a login — unavailable when the real server is connected. */
  enterDemo: (): AdminSession => {
    if (isBackendConfigured()) throw new Error("Demo mode is turned off: this admin is connected to the store server.");
    const s: AdminSession = { mode: "demo", role: "owner", since: new Date().toISOString() };
    sessionStorage.setItem(KEY, JSON.stringify(s));
    return s;
  },
  /** Ends the session (on the server in live mode). */
  signOut: async (): Promise<void> => {
    if (isBackendConfigured()) {
      serverSession = null;
      try { await apiRequest(API_ENDPOINTS.adminLogout, { method: "POST" }); } catch { /* cookie is cleared server-side when reachable; session also expires */ }
      return;
    }
    if (typeof window !== "undefined") sessionStorage.removeItem(KEY);
  },
};
