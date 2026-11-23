// REAL DATABASE TESTS — run against an actual MySQL/MariaDB database, no mocks.
//   TEST_DATABASE_URL="mysql://user:pass@127.0.0.1:3306/bya_test" npm run test:db
// The database is reset with the real migrations first, so its name must contain "test".
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import { createPrisma } from "../../src/db.js";
import { createLogger } from "../../src/logger.js";
import { createAdminUser } from "../../src/services/authService.js";
import { seedDatabase, type SeedCatalogue } from "../../src/services/seed.js";

const DB = process.env["TEST_DATABASE_URL"];
if (!DB) throw new Error("TEST_DATABASE_URL is required for the real-database tests.");
if (!/test/i.test(new URL(DB).pathname)) throw new Error("Refusing to reset a database whose name doesn't contain 'test'.");

const ORIGIN = "https://shop.example";
const OWNER = { email: "owner@test.beingyou", name: "Store Owner", password: "Monsoon-Tulsi-Ritual-27" };
const STAFF = { email: "staff@test.beingyou", name: "Staff Member", password: "Jasmine-Kesar-Notebook-81" };
const catalogue = JSON.parse(readFileSync(path.resolve(__dirname, "../../prisma/seed/catalogue.json"), "utf8")) as SeedCatalogue;

const config = loadConfig({ NODE_ENV: "test", DATABASE_URL: DB, CORS_ORIGINS: ORIGIN, LOG_LEVEL: "silent" });
let prisma: PrismaClient;
let app: ReturnType<typeof createApp>;
const logLines: string[] = [];

const json = (r: request.Test) => r.set("Origin", ORIGIN).set("Content-Type", "application/json");
async function signIn(who: { email: string; password: string }) {
  const res = await json(request(app).post("/api/auth/login")).send({ email: who.email, password: who.password });
  expect(res.status).toBe(200);
  const cookie = (res.headers["set-cookie"] as unknown as string[])[0]!;
  return cookie.split(";")[0]!;
}

const newProduct = {
  id: "test-rose-mist",
  slug: "test-rose-mist",
  name: "Test Rose Mist",
  category: "skincare",
  shortDescription: "Test product created by the integration test.",
  description: "",
  directions: "",
  ingredients: [],
  details: [],
  shape: "bottle",
  tint: "oklch(0.86 0.05 140)",
  images: ["asset:products/gallery/face-serum/01-hero.webp"],
  featured: false,
  bestSeller: false,
  status: "active",
  variants: [{ id: "test-rose-mist-100", label: "100 ml", kind: "size", price: 450, stock: 12 }],
};

beforeAll(async () => {
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", { env: { ...process.env, DATABASE_URL: DB }, stdio: "pipe" });
  prisma = createPrisma(DB);
  await seedDatabase(prisma, catalogue);
  await createAdminUser(prisma, { ...OWNER, role: "owner" });
  await createAdminUser(prisma, { ...STAFF, role: "staff" }, { allowAdditional: true });
  app = createApp({ config, prisma, logger: createLogger("debug", (l) => logLines.push(l)) });
});
afterAll(async () => { await prisma?.$disconnect(); });

describe("1-3. server, MySQL connection and migrations", () => {
  it("health check reports the database as reachable", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", database: "ok" });
  });
  it("migrations created every Phase 1 table", async () => {
    const rows = await prisma.$queryRaw<{ t: string }[]>`SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`;
    const tables = rows.map((r) => r.t);
    for (const t of ["User", "Role", "Permission", "RolePermission", "UserRole", "Session", "PasswordResetToken", "Category", "Product", "ProductVariant", "Inventory", "ProductImage", "Customer", "ShippingAddress", "Order", "OrderItem", "Payment", "Discount", "Review", "WhatsAppConsent", "SiteContent", "StoreSetting", "AdminActivityLog", "_prisma_migrations"]) expect(tables).toContain(t);
  });
});

describe("catalogue migration", () => {
  it("imports all configured products with their exact prices, shades and photos", async () => {
    expect(await prisma.product.count()).toBe(catalogue.products.length);
    expect(await prisma.product.count({ where: { status: "ACTIVE" } })).toBe(20);
    const res = await request(app).get("/api/products");
    expect(res.body.products).toHaveLength(20);
    for (const seeded of catalogue.products.filter((p) => p.status === "active")) {
      const got = res.body.products.find((p: { id: string }) => p.id === seeded.id);
      expect(got.variants.map((v: { label: string; price: number }) => [v.label, v.price])).toEqual(seeded.variants.map((v) => [v.label, v.price]));
      expect(got.images).toEqual(seeded.images ?? []);
    }
  });
  it("running the seed again creates no duplicates and keeps edits", async () => {
    await prisma.productVariant.update({ where: { id: catalogue.products[0]!.variants[0]!.id }, data: { price: 1 } });
    const r = await seedDatabase(prisma, catalogue);
    expect(r.productsCreated).toBe(0);
    expect(await prisma.product.count()).toBe(catalogue.products.length);
    expect(Number((await prisma.productVariant.findUnique({ where: { id: catalogue.products[0]!.variants[0]!.id } }))!.price)).toBe(1);
    await prisma.productVariant.update({ where: { id: catalogue.products[0]!.variants[0]!.id }, data: { price: catalogue.products[0]!.variants[0]!.price } });
  });
  it("creates no customers, orders or payments", async () => {
    expect(await prisma.customer.count()).toBe(0);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.payment.count()).toBe(0);
  });
  it("hidden drafts are not public", async () => {
    const draft = catalogue.products.find((p) => p.status === "draft")!;
    expect((await request(app).get(`/api/products/${draft.slug}`)).status).toBe(404);
  });
});

describe("4-6, 13. admin authentication", () => {
  it("4. valid credentials sign in with an httpOnly session cookie", async () => {
    const res = await json(request(app).post("/api/auth/login")).send({ email: OWNER.email.toUpperCase(), password: OWNER.password });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: OWNER.email, roles: ["owner"] });
    const cookie = (res.headers["set-cookie"] as unknown as string[])[0]!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|tokenHash/);
    const stored = await prisma.session.findMany();
    const token = decodeURIComponent(cookie.split(";")[0]!.split("=")[1]!);
    expect(stored.some((s) => s.tokenHash === token)).toBe(false);
  });
  it("5. a wrong password or unknown email is rejected with the same message", async () => {
    const a = await json(request(app).post("/api/auth/login")).send({ email: OWNER.email, password: "wrong-password-123" });
    const b = await json(request(app).post("/api/auth/login")).send({ email: "nobody@test.beingyou", password: "wrong-password-123" });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error.message).toBe(b.body.error.message);
    expect(a.headers["set-cookie"]).toBeUndefined();
  });
  it("6. protected APIs refuse requests without a session", async () => {
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
    expect((await request(app).get("/api/admin/products")).status).toBe(401);
    expect((await json(request(app).post("/api/admin/products")).send(newProduct)).status).toBe(401);
    expect((await request(app).get("/api/admin/products").set("Cookie", "bya_admin_session=forged-token")).status).toBe(401);
  });
  it("staff without product-edit permission can view but not change products", async () => {
    const cookie = await signIn(STAFF);
    expect((await request(app).get("/api/admin/products").set("Cookie", cookie)).status).toBe(200);
    expect((await json(request(app).post("/api/admin/products")).set("Cookie", cookie).send(newProduct)).status).toBe(403);
  });
  it("13. logout invalidates the session on the server", async () => {
    const cookie = await signIn(OWNER);
    expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(200);
    expect((await json(request(app).post("/api/auth/logout")).set("Cookie", cookie).send({})).status).toBe(200);
    expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(401);
  });
  it("locks the account for 15 minutes after 5 failed attempts", async () => {
    await createAdminUser(prisma, { email: "lock@test.beingyou", name: "Lock Test", password: "Cardamom-Window-Lantern-55", role: "admin" }, { allowAdditional: true });
    for (let i = 0; i < 5; i++) await json(request(app).post("/api/auth/login")).send({ email: "lock@test.beingyou", password: "nope-nope-nope-1" });
    const res = await json(request(app).post("/api/auth/login")).send({ email: "lock@test.beingyou", password: "Cardamom-Window-Lantern-55" });
    expect(res.status).toBe(429);
    const u = await prisma.user.findUnique({ where: { email: "lock@test.beingyou" } });
    const mins = (u!.lockedUntil!.getTime() - Date.now()) / 60_000;
    expect(mins).toBeGreaterThan(14);
    expect(mins).toBeLessThanOrEqual(15);
  });
  it("rejects cookie-authenticated writes from other websites or non-JSON bodies", async () => {
    const cookie = await signIn(OWNER);
    const evil = await request(app).post("/api/admin/products").set("Cookie", cookie).set("Origin", "https://evil.example").set("Content-Type", "application/json").send(newProduct);
    expect(evil.status).toBe(403);
    const form = await request(app).post("/api/auth/logout").set("Cookie", cookie).set("Origin", ORIGIN).type("form").send("a=1");
    expect(form.status).toBe(415);
    expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(200);
  });
});

describe("7-12. products persist in MySQL", () => {
  let cookie: string;
  beforeAll(async () => { cookie = await signIn(OWNER); });

  it("7-8. admin creates a product and it persists (read back through a new database connection)", async () => {
    const res = await json(request(app).post("/api/admin/products")).set("Cookie", cookie).send(newProduct);
    expect(res.status).toBe(201);
    const fresh = createPrisma(DB);
    const row = await fresh.product.findUnique({ where: { id: newProduct.id }, include: { variants: { include: { inventory: true } }, images: true } });
    await fresh.$disconnect();
    expect(row?.name).toBe("Test Rose Mist");
    expect(Number(row!.variants[0]!.price)).toBe(450);
    expect(row!.variants[0]!.inventory?.quantity).toBe(12);
    expect(row!.images.map((i) => i.url)).toEqual(newProduct.images);
    const logs = await prisma.adminActivityLog.findMany({ where: { entityId: newProduct.id } });
    expect(logs.map((l) => l.action)).toContain("product.create");
  });
  it("rejects a duplicate web address", async () => {
    const res = await json(request(app).post("/api/admin/products")).set("Cookie", cookie).send({ ...newProduct, id: "another-id" });
    expect(res.status).toBe(409);
  });
  it("9-10. a price change in admin shows on the public product", async () => {
    const res = await json(request(app).patch(`/api/admin/products/${newProduct.id}`)).set("Cookie", cookie)
      .send({ variants: [{ ...newProduct.variants[0], price: 525 }] });
    expect(res.status).toBe(200);
    const pub = await request(app).get(`/api/products/${newProduct.slug}`);
    expect(pub.body.product.variants[0].price).toBe(525);
    expect(pub.body.product.variants[0].stock).toBe(1);
    const log = await prisma.adminActivityLog.findFirst({ where: { entityId: newProduct.id, action: "product.update" }, orderBy: { id: "desc" } });
    expect(log!.summary).toContain("₹450 → ₹525");
  });
  it("refuses an invalid change and leaves the saved product untouched", async () => {
    const res = await json(request(app).patch(`/api/admin/products/${newProduct.id}`)).set("Cookie", cookie).send({ variants: [{ ...newProduct.variants[0], price: 0 }] });
    expect(res.status).toBe(400);
    expect((await request(app).get(`/api/products/${newProduct.slug}`)).body.product.variants[0].price).toBe(525);
  });
  it("11-12. hiding a product removes it from the public shop", async () => {
    expect((await json(request(app).patch(`/api/admin/products/${newProduct.id}`)).set("Cookie", cookie).send({ status: "draft" })).status).toBe(200);
    expect((await request(app).get(`/api/products/${newProduct.slug}`)).status).toBe(404);
    const list = await request(app).get("/api/products");
    expect(list.body.products.some((p: { id: string }) => p.id === newProduct.id)).toBe(false);
    const admin = await request(app).get(`/api/admin/products/${newProduct.id}`).set("Cookie", cookie);
    expect(admin.body.product.status).toBe("draft");
  });
  it("delete archives; permanent delete is refused for visible products", async () => {
    const visible = catalogue.products.find((p) => p.status === "active")!;
    expect((await json(request(app).delete(`/api/admin/products/${visible.id}?permanent=true`)).set("Cookie", cookie).send({})).status).toBe(409);
    const res = await json(request(app).delete(`/api/admin/products/${newProduct.id}`)).set("Cookie", cookie).send({});
    expect(res.body.product.status).toBe("archived");
    expect((await json(request(app).delete(`/api/admin/products/${newProduct.id}?permanent=true`)).set("Cookie", cookie).send({})).status).toBe(200);
    expect(await prisma.product.findUnique({ where: { id: newProduct.id } })).toBeNull();
  });
});

describe("14. server errors don't expose credentials", () => {
  it("an unreachable database returns a plain message without the connection details", async () => {
    const broken = DB.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:WrongPw-Secret-999@");
    const badPrisma = createPrisma(broken);
    const badApp = createApp({ config, prisma: badPrisma, logger: createLogger("debug", (l) => logLines.push(l)) });
    const health = await request(badApp).get("/api/health");
    expect(health.status).toBe(503);
    const login = await json(request(badApp).post("/api/auth/login")).send({ email: OWNER.email, password: OWNER.password });
    expect(login.status).toBeGreaterThanOrEqual(500);
    for (const body of [JSON.stringify(health.body), JSON.stringify(login.body)]) {
      expect(body).not.toContain("WrongPw-Secret-999");
      expect(body).not.toMatch(/mysql:\/\//);
    }
    expect(logLines.join("\n")).not.toContain("WrongPw-Secret-999");
    expect(logLines.join("\n")).not.toContain(OWNER.password);
    await badPrisma.$disconnect();
  });
});
