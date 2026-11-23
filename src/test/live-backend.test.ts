// Rules for switching the site from demo mode to the real Hostinger database.
// (The real-database tests live in server/tests/integration.)
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { isLiveAdminPath, parseApiBaseUrl } from "@/services/api";

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = path.join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

describe("API address", () => {
  it("accepts only an absolute http(s) address and drops the trailing slash", () => {
    expect(parseApiBaseUrl("https://api.beingyoualways.com/")).toBe("https://api.beingyoualways.com");
    expect(parseApiBaseUrl("")).toBeNull();
    expect(parseApiBaseUrl("/api")).toBeNull();
    expect(parseApiBaseUrl("api.beingyoualways.com")).toBeNull();
  });
  it("no localhost address is hard-coded in the website code", () => {
    const offenders = walk(path.resolve(__dirname, "..")).filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes(`${path.sep}test${path.sep}`))
      .filter((f) => /https?:\/\/(localhost|127\.0\.0\.1)/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
  it("this preview has no API address, so it stays in labelled demo mode", async () => {
    const { isBackendConfigured } = await import("@/services/api");
    expect(isBackendConfigured()).toBe(false);
  });
});

describe("live admin areas", () => {
  it("overview, products, orders, customers, discounts, settings, content, stories and approvals use the real database; the rest stay switched off", () => {
    for (const p of ["/admin", "/admin/", "/admin/products", "/admin/products/bya-1069", "/admin/orders", "/admin/orders/abc", "/admin/customers", "/admin/customers/abc", "/admin/discounts", "/admin/settings", "/admin/content", "/admin/testimonials", "/admin/approvals", "/admin/whatsapp", "/admin/whatsapp-api", "/admin/chatbot", "/admin/abandoned-cart"]) expect(isLiveAdminPath(p)).toBe(true);
    for (const p of ["/admin/products-old", "/admin/whatsapp-old", "/admin/analytics"]) expect(isLiveAdminPath(p)).toBe(false);
  });
});

describe("production builds never use demo data", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); localStorage.clear(); });
  it("a production build without a store server has demo mode, demo storage and demo reset switched off", async () => {
    vi.resetModules();
    vi.stubEnv("DEV", false);
    vi.stubEnv("PROD", true);
    localStorage.setItem("bya.products.v2", JSON.stringify([{ id: "fake", slug: "fake", name: "Fake demo edit", variants: [{ id: "v", price: 1 }] }]));
    const api = await import("@/services/api");
    expect(api.DEMO_MODE).toBe(false);
    expect(api.isUnconnectedProduction()).toBe(true);
    const { productService } = await import("@/services/productService");
    expect(productService.peekAll().some((p) => p.id === "fake")).toBe(false);
    await expect(productService.resetDemo()).rejects.toThrow(/switched off/);
    const { resetAllDemoData } = await import("@/services/backupService");
    await expect(resetAllDemoData()).rejects.toThrow(/switched off/);
  });
  it("the development preview (no server) is the only place demo mode is on", async () => {
    const api = await import("@/services/api");
    expect(api.DEMO_MODE).toBe(true);
  });
});

describe("connected admin sign-in", () => {
  beforeEach(() => { vi.resetModules(); vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); sessionStorage.clear(); });

  it("editing browser storage never opens the admin, and demo mode is switched off", async () => {
    const { adminAuthService } = await import("@/services/adminAuthService");
    sessionStorage.setItem("bya.admin.demo-session", JSON.stringify({ mode: "demo", role: "owner", since: "x" }));
    expect(adminAuthService.current()).toBeNull();
    expect(() => adminAuthService.enterDemo()).toThrow();
  });

  it("asks the server and treats a 401 as signed out (mocked server response)", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { code: "unauthorized", message: "Please sign in." } }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const { adminAuthService } = await import("@/services/adminAuthService");
    expect(await adminAuthService.check()).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/api/auth/me", expect.objectContaining({ credentials: "include" }));
  });

  it("an unreachable server is reported as a connection problem, never as saved (mocked network failure)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    const { productService } = await import("@/services/productService");
    const { products } = await import("@/lib/mock-data");
    await expect(productService.save({ ...products[0]!, variants: products[0]!.variants.map((v) => ({ ...v, price: v.price + 1 })) })).rejects.toThrow(/Can't reach the store server/);
  });
});
