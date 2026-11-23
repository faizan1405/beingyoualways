// PHASE 2 — REAL DATABASE TESTS for bag, checkout, COD, Razorpay (test double), stock, discounts and admin.
//   TEST_DATABASE_URL="mysql://user:pass@127.0.0.1:3306/bya_test" npm run test:db
// Razorpay's servers are replaced by tests/support/fakeRazorpay.ts (no network); signature checks run for real.
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp, createServices } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import { createPrisma } from "../../src/db.js";
import { createLogger } from "../../src/logger.js";
import { createAdminUser } from "../../src/services/authService.js";
import { seedDatabase, type SeedCatalogue } from "../../src/services/seed.js";
import { createFakeRazorpay } from "../support/fakeRazorpay.js";

const DB = process.env["TEST_DATABASE_URL"];
if (!DB) throw new Error("TEST_DATABASE_URL is required for the real-database tests.");
if (!/test/i.test(new URL(DB).pathname)) throw new Error("Refusing to reset a database whose name doesn't contain 'test'.");

const ORIGIN = "https://shop.example";
const OWNER = { email: "owner2@test.beingyou", name: "Store Owner", password: "Monsoon-Tulsi-Ritual-27" };
const STAFF = { email: "staff2@test.beingyou", name: "Staff Member", password: "Jasmine-Kesar-Notebook-81" };
const catalogue = JSON.parse(readFileSync(path.resolve(__dirname, "../../prisma/seed/catalogue.json"), "utf8")) as SeedCatalogue;
const config = loadConfig({ NODE_ENV: "test", DATABASE_URL: DB, CORS_ORIGINS: ORIGIN, LOG_LEVEL: "silent", ORDER_LINK_SECRET: "a".repeat(40) });

// Products used below (ids from the real catalogue)
const LIP = { productId: "bya-1049", a: "liquid-matte-lipstick-1", b: "liquid-matte-lipstick-2", price: 299 };
const SERUM = { productId: "bya-1069", variantId: "face-serum-1", price: 680 };
const OIL = { productId: "bya-1059", variantId: "hair-oil-1", price: 470 };
const SUN = { productId: "bya-1073", variantId: "sunscreen-1", price: 470 };
const UNCOUNTED = { productId: "bya-1027", variantId: "tomato-face-wash-1" };

let prisma: PrismaClient;
let app: ReturnType<typeof createApp>;
let services: ReturnType<typeof createServices>;
let rz: ReturnType<typeof createFakeRazorpay>;
let owner: string;
let staff: string;

const json = (r: request.Test) => r.set("Origin", ORIGIN).set("Content-Type", "application/json");
async function signIn(who: { email: string; password: string }, a = app) {
  const res = await json(request(a).post("/api/auth/login")).send({ email: who.email, password: who.password });
  expect(res.status).toBe(200);
  return (res.headers["set-cookie"] as unknown as string[])[0]!.split(";")[0]!;
}
const contact = (n = 1) => ({ name: `Test Shopper ${n}`, email: `shopper${n}@example.com`, phone: `+91 98765 ${String(43210 + n).slice(-5)}` });
const address = { line1: "12 Lake View Road, Flat 4B", line2: "", city: "Bengaluru", state: "Karnataka", pincode: "560001", type: "home" };
type Line = { productId: string; variantId: string; quantity: number; seenUnitPrice?: number };
const order = (lines: Line[], extra: Record<string, unknown> = {}) => ({ checkoutKey: randomUUID(), lines, contact: contact(), address, paymentMethod: "cod", ...extra });
const place = (body: object) => json(request(app).post("/api/checkout/orders")).send(body);
const stock = async (variantId: string) => prisma.inventory.findUniqueOrThrow({ where: { variantId } });
const setStock = (variantId: string, quantity: number | null) => prisma.inventory.update({ where: { variantId }, data: { quantity, reserved: 0 } });
const adminGet = (url: string, cookie = owner) => request(app).get(url).set("Cookie", cookie);
const adminPost = (url: string, body: object, cookie = owner, method: "post" | "put" | "patch" = "post") => json(request(app)[method](url)).set("Cookie", cookie).send(body);

beforeAll(async () => {
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", { env: { ...process.env, DATABASE_URL: DB }, stdio: "pipe" });
  prisma = createPrisma(DB);
  await seedDatabase(prisma, catalogue);
  await createAdminUser(prisma, { ...OWNER, role: "owner" });
  await createAdminUser(prisma, { ...STAFF, role: "staff" }, { allowAdditional: true });
  rz = createFakeRazorpay();
  const logger = createLogger("silent");
  services = createServices({ config, prisma, logger, gateway: rz.gateway });
  app = createApp({ config, prisma, logger, services });
  owner = await signIn(OWNER);
  staff = await signIn(STAFF);
});
afterAll(async () => { await prisma?.$disconnect(); });

describe("ordering stays blocked until the owner configures it", () => {
  it("uncounted stock can't be ordered and shipping not set up blocks checkout", async () => {
    await setStock(SERUM.variantId, 20);
    const q = await json(request(app).post("/api/checkout/quote")).send({ lines: [{ ...UNCOUNTED, quantity: 1 }, { ...SERUM, quantity: 1 }], paymentMethod: "cod" });
    expect(q.status).toBe(200);
    expect(q.body.lines[0].status).toBe("unavailable");
    expect(q.body.totals).toBeNull();
    expect(q.body.blockers.map((b: { code: string }) => b.code)).toContain("shipping_not_configured");
    expect(q.body.canPlaceOrder).toBe(false);
    const res = await place(order([{ ...SERUM, quantity: 1 }]));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("shipping_not_configured");
    expect(await prisma.order.count()).toBe(0);
  });
  it("staff can't change settings; the owner saves shipping and COD rules in paise", async () => {
    const ship = { enabled: true, flatFeePaise: 7900, freeAbovePaise: 99900, regions: { mode: "all_india", states: [], pincodePrefixes: [] }, estimateMinDays: 3, estimateMaxDays: 6, estimateNote: "", maxQtyPerLine: 10 };
    expect((await adminPost("/api/admin/settings/shipping", ship, staff, "put")).status).toBe(403);
    expect((await adminPost("/api/admin/settings/shipping", { ...ship, flatFeePaise: 79.5 }, owner, "put")).status).toBe(400);
    const s = await adminPost("/api/admin/settings/shipping", ship, owner, "put");
    expect(s.status).toBe(200);
    expect(s.body.readiness.shipping).toEqual([]);
    const c = await adminPost("/api/admin/settings/cod", { enabled: true, feePaise: 4900, minOrderPaise: null, maxOrderPaise: 300000, regions: { mode: "all_shipping", states: [], pincodePrefixes: [] } }, owner, "put");
    expect(c.status).toBe(200);
    expect(c.body.readiness.cod).toEqual([]);
    const pub = await request(app).get("/api/checkout/config");
    expect(pub.body.shipping).toMatchObject({ configured: true, flatFeePaise: 7900, freeAbovePaise: 99900, estimate: "Usually delivered in 3–6 working days" });
    expect(pub.body.cod).toMatchObject({ available: true, feePaise: 4900 });
    expect(pub.body.razorpay).toEqual({ available: true, testMode: true });
  });
});

describe("1-3. bag: database prices, variants, quantities", () => {
  it("admin enters real stock and the shop shows it as orderable (without counts)", async () => {
    const p = (await adminGet(`/api/admin/products/${LIP.productId}`)).body.product;
    const res = await adminPost(`/api/admin/products/${LIP.productId}`, { variants: p.variants.map((v: { id: string }, i: number) => ({ ...v, stock: i < 2 ? 15 : 0, stockTracked: i < 2 })) }, owner, "patch");
    expect(res.status).toBe(200);
    const pub = (await request(app).get(`/api/products/${LIP.productId}`)).body.product;
    expect(pub.variants.slice(0, 3).map((v: { stock: number }) => v.stock)).toEqual([1, 1, 0]);
    expect(JSON.stringify(pub)).not.toContain("15");
    await setStock(OIL.variantId, 10);
  });
  it("prices come from MySQL; a browser-sent price is never used, only reported as changed", async () => {
    const q = await json(request(app).post("/api/checkout/quote")).send({ lines: [{ productId: LIP.productId, variantId: LIP.a, quantity: 2, seenUnitPrice: 1 }], paymentMethod: "cod" });
    expect(q.body.lines[0]).toMatchObject({ unitPaise: 29900, lineTotalPaise: 59800, status: "ok", priceChanged: { fromPaise: 100, toPaise: 29900 } });
    expect(q.body.totals).toEqual({ subtotalPaise: 59800, discountPaise: 0, shippingPaise: 7900, codFeePaise: 4900, totalPaise: 72600 });
  });
  it("changing quantity and shade is re-priced; free shipping applies from ₹999", async () => {
    const q = await json(request(app).post("/api/checkout/quote")).send({ lines: [{ productId: LIP.productId, variantId: LIP.b, quantity: 1 }, { ...SERUM, quantity: 1 }], paymentMethod: "razorpay" });
    expect(q.body.totals).toEqual({ subtotalPaise: 97900, discountPaise: 0, shippingPaise: 7900, codFeePaise: 0, totalPaise: 105800 });
    const q2 = await json(request(app).post("/api/checkout/quote")).send({ lines: [{ productId: LIP.productId, variantId: LIP.b, quantity: 2 }, { ...SERUM, quantity: 1 }], paymentMethod: "razorpay" });
    expect(q2.body.totals).toMatchObject({ subtotalPaise: 127800, shippingPaise: 0, totalPaise: 127800 });
  });
  it("rejects a variant sent with the wrong product, over-limit quantities and too much quantity", async () => {
    const wrong = await json(request(app).post("/api/checkout/quote")).send({ lines: [{ productId: SERUM.productId, variantId: LIP.a, quantity: 1 }] });
    expect(wrong.body.lines[0].status).toBe("unavailable");
    const limit = await json(request(app).post("/api/checkout/quote")).send({ lines: [{ ...SERUM, quantity: 11 }] });
    expect(limit.body.lines[0].status).toBe("limit");
    const more = await json(request(app).post("/api/checkout/quote")).send({ lines: [{ ...OIL, quantity: 1 }], destination: { state: "Karnataka", pincode: "560001" } });
    expect(more.body.canPlaceOrder).toBe(false); // no payment method chosen yet
    const bad = await json(request(app).post("/api/checkout/quote")).send({ lines: [{ ...OIL, quantity: 0 }] });
    expect(bad.status).toBe(400);
  });
});

let codOrderNumber = "";
let codToken = "";
describe("4-7. checkout validation and a real Cash on Delivery order", () => {
  it("validates contact and address on the server", async () => {
    const res = await place(order([{ ...SERUM, quantity: 1 }], { contact: { name: "A", email: "nope", phone: "12345" }, address: { ...address, pincode: "012345", state: "Atlantis" } }));
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    for (const f of ["contact.name", "contact.email", "contact.phone", "address.state", "address.pincode"]) expect(fields).toContain(f);
  });
  it("creates a COD order: unpaid, stock deducted, visible in admin", async () => {
    const before = (await stock(SERUM.variantId)).quantity!;
    const res = await place(order([{ ...SERUM, quantity: 2, seenUnitPrice: 1 }]));
    expect(res.status).toBe(201);
    expect(res.body.order).toMatchObject({ status: "NEW", paymentMethod: "cod", paymentStatus: "COD_PENDING", totals: { subtotalPaise: 136000, shippingPaise: 0, codFeePaise: 4900, totalPaise: 140900 } });
    expect(res.body.order.orderNumber).toMatch(/^BYA-\d{6}-[A-Z0-9]{5}$/);
    expect(res.body.payment).toBeNull();
    codOrderNumber = res.body.order.orderNumber; codToken = res.body.accessToken;
    expect((await stock(SERUM.variantId)).quantity).toBe(before - 2);
    const list = await adminGet("/api/admin/orders");
    const row = list.body.orders.find((o: { orderNumber: string }) => o.orderNumber === codOrderNumber);
    expect(row).toMatchObject({ paymentStatus: "COD_PENDING", status: "NEW", customerName: "Test Shopper 1", phone: "9876543211" });
    const db = await prisma.order.findUniqueOrThrow({ where: { orderNumber: codOrderNumber }, include: { payments: true } });
    expect(Number(db.grandTotal)).toBe(1409);
    expect(db.payments[0]!.status).toBe("PENDING");
    expect(db.isTest).toBe(false);
  });
  it("the shopper's private order link works; a wrong token doesn't", async () => {
    expect((await json(request(app).post("/api/checkout/orders/lookup")).send({ orderNumber: codOrderNumber, token: codToken })).body.order.paymentStatus).toBe("COD_PENDING");
    expect((await json(request(app).post("/api/checkout/orders/lookup")).send({ orderNumber: codOrderNumber, token: "x".repeat(43) })).status).toBe(404);
  });
  it("COD is refused above the owner's COD maximum", async () => {
    await setStock(SERUM.variantId, 20);
    const res = await place(order([{ ...SERUM, quantity: 5 }]));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("cod_unavailable");
    expect((await stock(SERUM.variantId)).quantity).toBe(20); // rolled back
  });
});

describe("15. repeated checkout submissions", () => {
  it("the same checkout key returns the same order and deducts stock once", async () => {
    await setStock(OIL.variantId, 10);
    const body = order([{ ...OIL, quantity: 1 }], { contact: contact(2) });
    const [a, b] = await Promise.all([place(body), place(body)]);
    expect([a.status, b.status].sort(), JSON.stringify([a.body, b.body])).toEqual([200, 201]);
    expect(a.body.order.orderNumber).toBe(b.body.order.orderNumber);
    expect(await prisma.order.count({ where: { checkoutKey: body.checkoutKey } })).toBe(1);
    expect((await stock(OIL.variantId)).quantity).toBe(9);
    const c = await place({ ...body, lines: [{ ...OIL, quantity: 3 }] });
    expect(c.status).toBe(409);
    expect(c.body.error.code).toBe("checkout_reused");
  });
});

describe("8-14. Razorpay (Test Mode double): verify, fail, cancel, webhooks, out of order", () => {
  const start = async (qty = 1, n = 3) => {
    const res = await place(order([{ ...OIL, quantity: qty }], { paymentMethod: "razorpay", contact: contact(n) }));
    expect(res.status).toBe(201);
    return res.body as { order: { orderNumber: string; status: string; totals: { totalPaise: number } }; accessToken: string; payment: { razorpayOrderId: string; amountPaise: number; keyId: string } };
  };
  const verify = (o: { order: { orderNumber: string }; accessToken: string }, checkout: Record<string, string>) =>
    json(request(app).post("/api/checkout/razorpay/verify")).send({ orderNumber: o.order.orderNumber, token: o.accessToken, ...checkout });
  const hook = (w: { raw: Buffer; signature: string; eventId: string }, sig = w.signature) =>
    request(app).post("/api/webhooks/razorpay").set("Content-Type", "application/json").set("X-Razorpay-Signature", sig).set("X-Razorpay-Event-Id", w.eventId).send(w.raw.toString("utf8")); // sent byte-for-byte as Razorpay does

  it("8-9. successful payment: pending order + stock hold, then verified signature → paid and stock committed", async () => {
    await setStock(OIL.variantId, 10);
    const o = await start(2);
    expect(o.order.status).toBe("PENDING_PAYMENT");
    expect(o.payment).toMatchObject({ keyId: "rzp_test_FAKEKEY", amountPaise: o.order.totals.totalPaise });
    expect(await stock(OIL.variantId)).toMatchObject({ quantity: 10, reserved: 2 });
    const { checkout } = rz.pay(o.payment.razorpayOrderId);
    const res = await verify(o, checkout);
    expect(res.status).toBe(200);
    expect(res.body.order).toMatchObject({ status: "NEW", paymentStatus: "PAID", isTest: true });
    expect(await stock(OIL.variantId)).toMatchObject({ quantity: 8, reserved: 0 });
    const db = await prisma.order.findUniqueOrThrow({ where: { orderNumber: o.order.orderNumber }, include: { payments: true } });
    expect(db.payments[0]).toMatchObject({ status: "PAID", providerPaymentId: checkout.razorpay_payment_id });
    expect(db.payments[0]!.signatureVerifiedAt).not.toBeNull();
  });
  it("a forged checkout signature is refused and the order stays unpaid", async () => {
    const o = await start(1, 4);
    const { checkout } = rz.pay(o.payment.razorpayOrderId);
    const res = await verify(o, { ...checkout, razorpay_signature: "0".repeat(64) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_signature");
    expect((await prisma.order.findUniqueOrThrow({ where: { orderNumber: o.order.orderNumber } })).paymentStatus).toBe("PENDING");
    expect(await prisma.paymentEvent.count({ where: { outcome: "rejected_signature" } })).toBe(1);
  });
  it("10-11. failed payment and closed payment window keep the order payable; retry reuses the same order", async () => {
    const o = await start(1, 5);
    const failed = rz.pay(o.payment.razorpayOrderId, { status: "failed" });
    const f = await json(request(app).post("/api/checkout/razorpay/problem")).send({ orderNumber: o.order.orderNumber, token: o.accessToken, kind: "failed", razorpay_payment_id: failed.payment.id, reason: "declined" });
    expect(f.body.order.status).toBe("PENDING_PAYMENT");
    const wh = await hook(rz.webhook("payment.failed", failed.payment));
    expect(wh.body, JSON.stringify(wh.body)).toMatchObject({ outcome: "recorded" });
    await json(request(app).post("/api/checkout/razorpay/problem")).send({ orderNumber: o.order.orderNumber, token: o.accessToken, kind: "cancelled" });
    const ordersBefore = await prisma.order.count();
    const retry = await json(request(app).post("/api/checkout/orders/retry-payment")).send({ orderNumber: o.order.orderNumber, token: o.accessToken });
    expect(retry.status).toBe(200);
    expect(retry.body.payment.razorpayOrderId).toBe(o.payment.razorpayOrderId);
    expect(await prisma.order.count()).toBe(ordersBefore);
    const ok = rz.pay(o.payment.razorpayOrderId);
    expect((await verify(o, ok.checkout)).body.order.paymentStatus).toBe("PAID");
  });
  it("12. a webhook with an invalid signature is rejected and changes nothing", async () => {
    const o = await start(1, 6);
    const p = rz.pay(o.payment.razorpayOrderId);
    const res = await hook(rz.webhook("payment.captured", p.payment), "f".repeat(64));
    expect(res.status).toBe(400);
    expect((await prisma.order.findUniqueOrThrow({ where: { orderNumber: o.order.orderNumber } })).paymentStatus).toBe("PENDING");
  });
  it("13-14. duplicate and out-of-order webhooks: paid once, stock committed once, late failure ignored", async () => {
    await setStock(OIL.variantId, 10);
    const o = await start(3, 7);
    const p = rz.pay(o.payment.razorpayOrderId);
    const w = rz.webhook("payment.captured", p.payment);
    const [a, b] = await Promise.all([hook(w), hook(w)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect([a.body.duplicate, b.body.duplicate].filter(Boolean)).toHaveLength(1);
    await hook(rz.webhook("order.paid", p.payment));
    expect((await verify(o, p.checkout)).body.order.paymentStatus).toBe("PAID"); // browser confirmation after the webhook: no-op
    const late = await hook(rz.webhook("payment.failed", { ...p.payment, status: "failed" }));
    expect(late.body.outcome).toBe("ignored_stale");
    expect(await stock(OIL.variantId)).toMatchObject({ quantity: 7, reserved: 0 });
    const db = await prisma.order.findUniqueOrThrow({ where: { orderNumber: o.order.orderNumber } });
    expect(db).toMatchObject({ paymentStatus: "PAID", status: "NEW", stockState: "COMMITTED" });
  });
  it("a payment for the wrong amount is not accepted", async () => {
    const o = await start(1, 8);
    const p = rz.pay(o.payment.razorpayOrderId, { amountPaise: 100 });
    const res = await verify(o, p.checkout);
    expect(res.status).toBe(400);
    expect((await prisma.order.findUniqueOrThrow({ where: { orderNumber: o.order.orderNumber } })).paymentStatus).toBe("PENDING");
  });
  it("interrupted checkout (tab closed after paying, no webhook) is found by reconciliation", async () => {
    const o = await start(1, 9);
    rz.pay(o.payment.razorpayOrderId);
    const r = await adminPost("/api/admin/payments/reconcile", {});
    expect(r.status).toBe(200);
    expect(r.body.paid).toBeGreaterThanOrEqual(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { orderNumber: o.order.orderNumber } })).paymentStatus).toBe("PAID");
  });
  it("an unpaid order past its hold is released; a payment arriving later re-opens it", async () => {
    await setStock(OIL.variantId, 5);
    const o = await start(2, 10);
    expect((await stock(OIL.variantId)).reserved).toBe(2);
    await prisma.order.update({ where: { orderNumber: o.order.orderNumber }, data: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    const r = await services.checkout.expireStale();
    expect(r.released).toBe(1);
    expect(await stock(OIL.variantId)).toMatchObject({ quantity: 5, reserved: 0 });
    expect(await prisma.order.findUniqueOrThrow({ where: { orderNumber: o.order.orderNumber } })).toMatchObject({ status: "CANCELLED", stockState: "RELEASED" });
    const p = rz.pay(o.payment.razorpayOrderId);
    expect((await hook(rz.webhook("payment.captured", p.payment))).body.outcome).toBe("applied");
    expect(await prisma.order.findUniqueOrThrow({ where: { orderNumber: o.order.orderNumber } })).toMatchObject({ status: "NEW", paymentStatus: "PAID", stockState: "COMMITTED" });
    expect((await stock(OIL.variantId)).quantity).toBe(3);
  });
  it("if Razorpay can't be reached the order is kept and payment can be retried", async () => {
    rz.setCreateFails(true);
    const res = await place(order([{ ...OIL, quantity: 1 }], { paymentMethod: "razorpay", contact: contact(11) }));
    rz.setCreateFails(false);
    expect(res.status).toBe(201);
    expect(res.body.paymentStartFailed).toBe(true);
    expect(res.body.payment).toBeNull();
    const retry = await json(request(app).post("/api/checkout/orders/retry-payment")).send({ orderNumber: res.body.order.orderNumber, token: res.body.accessToken });
    expect(retry.body.payment.razorpayOrderId).toMatch(/^order_/);
  });
});

describe("Phase 5: late payments, refunds and interrupted webhooks", () => {
  const start = async (qty: number, n: number) => {
    const res = await place(order([{ ...OIL, quantity: qty }], { paymentMethod: "razorpay", contact: contact(n) }));
    expect(res.status).toBe(201);
    return res.body as { order: { orderNumber: string }; accessToken: string; payment: { razorpayOrderId: string } };
  };
  const hook = (w: { raw: Buffer; signature: string; eventId: string }) =>
    request(app).post("/api/webhooks/razorpay").set("Content-Type", "application/json").set("X-Razorpay-Signature", w.signature).set("X-Razorpay-Event-Id", w.eventId).send(w.raw.toString("utf8"));
  const events = (orderNumber: string) => prisma.orderEvent.findMany({ where: { order: { orderNumber } } }).then((e) => e.map((x) => x.message).join("\n"));
  let refundable: { payment: Parameters<ReturnType<typeof createFakeRazorpay>["refund"]>[0]; orderNumber: string } | null = null;

  it("a payment arriving after the stock was sold to someone else is recorded, takes no stock and is flagged", async () => {
    await setStock(OIL.variantId, 2);
    const o = await start(2, 21);
    await prisma.order.update({ where: { orderNumber: o.order.orderNumber }, data: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    expect((await services.checkout.expireStale()).released).toBeGreaterThanOrEqual(1);
    expect((await place(order([{ ...OIL, quantity: 2 }], { contact: contact(22) }))).status).toBe(201); // COD buyer takes the last two
    expect(await stock(OIL.variantId)).toMatchObject({ quantity: 0, reserved: 0 });
    const p = rz.pay(o.payment.razorpayOrderId);
    expect((await hook(rz.webhook("payment.captured", p.payment))).body.outcome).toBe("applied");
    const db = await prisma.order.findUniqueOrThrow({ where: { orderNumber: o.order.orderNumber } });
    expect(db).toMatchObject({ paymentStatus: "PAID", status: "NEW", stockState: "RELEASED" });
    expect(await stock(OIL.variantId)).toMatchObject({ quantity: 0, reserved: 0 }); // never negative, never partly taken
    expect(await events(o.order.orderNumber)).toMatch(/Needs attention: .*No stock was taken/);
    // cancelling it later must not invent stock that was never taken
    expect((await adminPost(`/api/admin/orders/${db.id}/cancel`, { reason: "Out of stock — refunding" })).status).toBe(200);
    expect((await stock(OIL.variantId)).quantity).toBe(0);
    refundable = { payment: p.payment, orderNumber: o.order.orderNumber };
  });

  it("refund webhooks (refund entity only) are matched to the payment; a full refund marks the order refunded", async () => {
    await setStock(OIL.variantId, 10);
    const o = await start(1, 23);
    const p = rz.pay(o.payment.razorpayOrderId);
    expect((await hook(rz.webhook("payment.captured", p.payment))).body.outcome).toBe("applied");
    const partial = await hook(rz.refund(p.payment, 1000));
    expect(partial.body.outcome).toBe("recorded");
    expect((await prisma.order.findUniqueOrThrow({ where: { orderNumber: o.order.orderNumber } })).paymentStatus).toBe("PAID");
    const rest = p.payment.amountPaise - 1000;
    expect((await hook(rz.refund(p.payment, rest))).body.outcome).toBe("recorded");
    expect((await prisma.order.findUniqueOrThrow({ where: { orderNumber: o.order.orderNumber } })).paymentStatus).toBe("REFUNDED");
    expect(await events(o.order.orderNumber)).toMatch(/refunded so far/);
    expect(refundable).not.toBeNull();
  });

  it("a webhook left half-processed by a crash is processed when Razorpay retries it; a live one is not doubled", async () => {
    const o = await start(1, 24);
    const p = rz.pay(o.payment.razorpayOrderId);
    const w = rz.webhook("payment.captured", p.payment);
    await prisma.paymentEvent.create({ data: { provider: "razorpay", eventId: `wh:${w.eventId}`, eventType: "payment.captured", source: "webhook", signatureValid: true, outcome: "processing", createdAt: new Date(Date.now() - 10 * 60_000) } });
    const retried = await hook(w);
    expect(retried.body.outcome).toBe("applied");
    expect((await prisma.order.findUniqueOrThrow({ where: { orderNumber: o.order.orderNumber } })).paymentStatus).toBe("PAID");
    const w2 = rz.webhook("payment.captured", p.payment);
    await prisma.paymentEvent.create({ data: { provider: "razorpay", eventId: `wh:${w2.eventId}`, eventType: "payment.captured", source: "webhook", signatureValid: true, outcome: "processing" } });
    expect((await hook(w2)).body.duplicate).toBe(true);
  });
});

describe("16. insufficient stock and concurrent orders", () => {
  it("refuses more than is available", async () => {
    await setStock(SUN.variantId, 3);
    const q = await json(request(app).post("/api/checkout/quote")).send({ lines: [{ ...SUN, quantity: 4 }] });
    expect(q.body.lines[0].status).toBe("insufficient_stock");
    expect(JSON.stringify(q.body)).not.toMatch(/only 3/i);
    expect((await place(order([{ ...SUN, quantity: 4 }]))).status).toBe(409);
  });
  it("6 shoppers race for the last 3 units: exactly 3 orders succeed, stock never goes negative", async () => {
    await setStock(SUN.variantId, 3);
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => place(order([{ ...SUN, quantity: 1 }], { contact: contact(20 + i), paymentMethod: i % 2 ? "razorpay" : "cod" }))));
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.status === 409).every((r) => r.body.error.code === "insufficient_stock")).toBe(true);
    const s = await stock(SUN.variantId);
    expect(s.quantity! - s.reserved).toBe(0);
    expect(s.quantity).toBeGreaterThanOrEqual(0);
  });
});

describe("17. discount codes", () => {
  let tenId = "";
  it("owner creates codes; staff can't", async () => {
    const body = { code: "glow10", type: "PERCENT", percentOff: 10, minOrderPaise: 50000, usageLimit: 1, active: true };
    expect((await adminPost("/api/admin/discounts", body, staff)).status).toBe(403);
    const res = await adminPost("/api/admin/discounts", body);
    expect(res.status).toBe(201);
    expect(res.body.discount).toMatchObject({ code: "GLOW10", percentOff: 10, minOrderPaise: 50000, usedCount: 0 });
    tenId = res.body.discount.id;
    expect((await adminPost("/api/admin/discounts", { code: "HAIR50", type: "FIXED", amountOffPaise: 5000, categorySlugs: ["haircare"], active: true })).status).toBe(201);
  });
  it("percent and fixed amounts, minimum order and eligible categories are calculated on the server", async () => {
    await setStock(SERUM.variantId, 20); await setStock(OIL.variantId, 20);
    const q = await json(request(app).post("/api/checkout/quote")).send({ lines: [{ ...SERUM, quantity: 1 }], discountCode: "glow10", paymentMethod: "razorpay" });
    expect(q.body.discount).toMatchObject({ ok: true, amountPaise: 6800 });
    expect(q.body.totals).toEqual({ subtotalPaise: 68000, discountPaise: 6800, shippingPaise: 7900, codFeePaise: 0, totalPaise: 69100 });
    const small = await json(request(app).post("/api/checkout/quote")).send({ lines: [{ ...LIP, variantId: LIP.a, quantity: 1 }], discountCode: "GLOW10" });
    expect(small.body.discount.ok).toBe(false);
    const hair = await json(request(app).post("/api/checkout/quote")).send({ lines: [{ ...SERUM, quantity: 1 }, { ...OIL, quantity: 1 }], discountCode: "HAIR50" });
    expect(hair.body.totals).toMatchObject({ subtotalPaise: 115000, discountPaise: 5000, shippingPaise: 0 });
    const none = await json(request(app).post("/api/checkout/quote")).send({ lines: [{ ...SERUM, quantity: 1 }], discountCode: "HAIR50" });
    expect(none.body.discount.ok).toBe(false);
    expect((await json(request(app).post("/api/checkout/quote")).send({ lines: [{ ...SERUM, quantity: 1 }], discountCode: "NOPE" })).body.discount.ok).toBe(false);
  });
  it("a single-use code can only be redeemed once, even by two shoppers at the same moment", async () => {
    const [a, b] = await Promise.all([
      place(order([{ ...SERUM, quantity: 1 }], { discountCode: "GLOW10", paymentMethod: "razorpay", contact: contact(40) })),
      place(order([{ ...SERUM, quantity: 1 }], { discountCode: "GLOW10", paymentMethod: "razorpay", contact: contact(41) })),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const win = a.status === 201 ? a : b;
    expect(win.body.order.totals.discountPaise).toBe(6800);
    expect((await prisma.discount.findUniqueOrThrow({ where: { id: tenId } })).usedCount).toBe(1);
    // the unpaid order expires → the code becomes usable again
    await prisma.order.update({ where: { orderNumber: win.body.order.orderNumber }, data: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    await services.checkout.expireStale();
    expect((await prisma.discount.findUniqueOrThrow({ where: { id: tenId } })).usedCount).toBe(0);
  });
});

describe("admin orders: safe status changes, cancel, tracking, COD collection, CSV", () => {
  let id = "";
  beforeAll(async () => { id = (await prisma.order.findUniqueOrThrow({ where: { orderNumber: codOrderNumber } })).id; });
  it("refuses skipping steps and never lets staff mark an order paid", async () => {
    expect((await adminPost(`/api/admin/orders/${id}/status`, { to: "DELIVERED" })).status).toBe(409);
    expect((await adminPost(`/api/admin/orders/${id}/cod-collected`, { amountPaise: 140900, reference: "x1" }, staff)).status).toBe(403);
    expect((await adminPost(`/api/admin/orders/${id}/status`, { to: "CONFIRMED" }, staff)).status).toBe(403);
    expect((await adminPost(`/api/admin/orders/${id}/cancel`, { reason: "Customer asked" }, staff)).status).toBe(403);
    expect((await adminPost(`/api/admin/orders/${id}`, { paymentStatus: "PAID" }, owner, "patch")).status).toBe(404);
  });
  it("moves through fulfilment with tracking; delivery alone doesn't mark COD paid", async () => {
    for (const to of ["CONFIRMED", "PROCESSING"]) expect((await adminPost(`/api/admin/orders/${id}/status`, { to })).status).toBe(200);
    expect((await adminPost(`/api/admin/orders/${id}/shipment`, { carrier: "Delhivery", trackingNumber: "DL123456", trackingUrl: "http://x.example" })).status).toBe(400);
    expect((await adminPost(`/api/admin/orders/${id}/shipment`, { carrier: "Delhivery", trackingNumber: "DL123456", trackingUrl: "https://track.example/DL123456" })).status).toBe(200);
    for (const to of ["SHIPPED", "DELIVERED"]) expect((await adminPost(`/api/admin/orders/${id}/status`, { to })).status).toBe(200);
    const d = (await adminGet(`/api/admin/orders/${id}`)).body.order;
    expect(d).toMatchObject({ status: "DELIVERED", paymentStatus: "COD_PENDING", canCancel: false, canRecordCod: true });
    expect(d.timeline.map((e: { type: string }) => e.type)).toEqual(expect.arrayContaining(["created", "status", "shipment"]));
    expect((await adminPost(`/api/admin/orders/${id}/notes`, { text: "Customer prefers evening delivery" })).body.order.timeline.at(-1).note).toBe("Customer prefers evening delivery");
  });
  it("records COD cash only for the exact total, with an audit trail", async () => {
    expect((await adminPost(`/api/admin/orders/${id}/cod-collected`, { amountPaise: 100000, reference: "REM-1" })).status).toBe(400);
    const ok = await adminPost(`/api/admin/orders/${id}/cod-collected`, { amountPaise: 140900, reference: "REM-1" });
    expect(ok.status).toBe(200);
    expect(ok.body.order.paymentStatus).toBe("PAID");
    expect(ok.body.order.payments[0]).toMatchObject({ status: "PAID", recordedBy: "Store Owner", reference: "REM-1" });
    expect(await prisma.adminActivityLog.count({ where: { action: "payment.cod_collected", entityId: id } })).toBe(1);
    expect((await adminPost(`/api/admin/orders/${id}/cod-collected`, { amountPaise: 140900, reference: "REM-1" })).status).toBe(409);
  });
  it("cancelling an unshipped COD order puts stock back once and releases nothing twice", async () => {
    await setStock(OIL.variantId, 4);
    const res = await place(order([{ ...OIL, quantity: 2 }], { contact: contact(50) }));
    const oid = (await prisma.order.findUniqueOrThrow({ where: { orderNumber: res.body.order.orderNumber } })).id;
    expect((await stock(OIL.variantId)).quantity).toBe(2);
    expect((await adminPost(`/api/admin/orders/${oid}/cancel`, { reason: "Customer asked" })).status).toBe(200);
    expect((await stock(OIL.variantId)).quantity).toBe(4);
    expect((await adminPost(`/api/admin/orders/${oid}/cancel`, { reason: "Again" })).status).toBe(409);
    expect((await stock(OIL.variantId)).quantity).toBe(4);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: oid } })).toMatchObject({ status: "CANCELLED", paymentStatus: "CANCELLED", stockState: "RESTORED" });
  });
  it("search, filters and CSV export use real records", async () => {
    const byPhone = await adminGet("/api/admin/orders?q=9876543211");
    expect(byPhone.body.orders.map((o: { orderNumber: string }) => o.orderNumber)).toContain(codOrderNumber);
    const cod = await adminGet("/api/admin/orders?method=COD&status=DELIVERED");
    expect(cod.body.orders.every((o: { paymentMethod: string; status: string }) => o.paymentMethod === "COD" && o.status === "DELIVERED")).toBe(true);
    const csv = await adminGet("/api/admin/orders/export.csv");
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.text).toContain(codOrderNumber);
    expect(csv.text.split("\n").length - 1).toBe(await prisma.order.count({ where: { isTest: false } }));
  });
  it("customers come from orders with real order counts and paid spend", async () => {
    const list = await adminGet("/api/admin/customers?q=Test Shopper 1");
    const c = list.body.customers.find((x: { phone: string }) => x.phone === "9876543211");
    expect(c).toMatchObject({ orderCount: expect.any(Number), paidSpendPaise: 140900 });
    expect((await adminPost(`/api/admin/customers/${c.id}`, { notes: "VIP" }, staff, "patch")).status).toBe(403);
    expect((await adminPost(`/api/admin/customers/${c.id}`, { notes: "VIP" }, owner, "patch")).body.customer.notes).toBe("VIP");
  });
});

describe("18. dashboard totals match the database", () => {
  it("revenue counts verified paid non-test orders only; COD outstanding is separate", async () => {
    const d = (await adminGet("/api/admin/dashboard")).body;
    const paid = await prisma.order.aggregate({ where: { paymentStatus: "PAID", isTest: false }, _sum: { grandTotal: true } });
    const cod = await prisma.order.aggregate({ where: { paymentStatus: "COD_PENDING", isTest: false, status: { notIn: ["CANCELLED", "RETURNED"] } }, _sum: { grandTotal: true } });
    expect(d.revenuePaise).toBe(Math.round(Number(paid._sum.grandTotal ?? 0) * 100));
    expect(d.revenuePaise).toBe(140900); // only the collected COD order — Razorpay test-mode payments are not sales
    expect(d.codOutstandingPaise).toBe(Math.round(Number(cod._sum.grandTotal ?? 0) * 100));
    expect(d.testOrders).toBeGreaterThan(0);
    expect(d.orderCount).toBe(await prisma.order.count({ where: { isTest: false, status: { not: "PENDING_PAYMENT" } } }));
    const withTest = (await adminGet("/api/admin/dashboard?includeTest=true")).body;
    expect(withTest.revenuePaise).toBeGreaterThan(d.revenuePaise);
    expect(d.series.reduce((s: number, x: { paidPaise: number }) => s + x.paidPaise, 0)).toBe(d.revenuePaise);
    expect(d.topProducts[0].quantity).toBeGreaterThan(0);
  });
  it("an order placed before the range but paid inside it counts on the day it was paid, in the total and the chart", async () => {
    const paidOne = await prisma.order.findFirstOrThrow({ where: { paymentStatus: "PAID", isTest: false } });
    await prisma.order.update({ where: { id: paidOne.id }, data: { createdAt: new Date(Date.now() - 60 * 86_400_000) } });
    try {
      const d = (await adminGet("/api/admin/dashboard")).body;
      expect(d.revenuePaise).toBeGreaterThanOrEqual(Math.round(Number(paidOne.grandTotal) * 100));
      expect(d.series.reduce((s: number, x: { paidPaise: number }) => s + x.paidPaise, 0)).toBe(d.revenuePaise);
    } finally {
      await prisma.order.update({ where: { id: paidOne.id }, data: { createdAt: paidOne.createdAt } });
    }
  });
  it("an empty date range shows zeros, not sample figures", async () => {
    const d = (await adminGet("/api/admin/dashboard?from=2020-01-01&to=2020-01-31")).body;
    expect(d).toMatchObject({ revenuePaise: 0, orderCount: 0, codOutstandingPaise: 0, topProducts: [], series: [] });
  });
});

describe("19. persistence across sessions and connections", () => {
  it("a second browser session on a fresh server connection sees the same orders", async () => {
    const prisma2 = createPrisma(DB);
    const app2 = createApp({ config, prisma: prisma2, logger: createLogger("silent"), gateway: rz.gateway });
    const cookie = await signIn(OWNER, app2);
    const res = await request(app2).get(`/api/admin/orders?q=${codOrderNumber}`).set("Cookie", cookie);
    expect(res.body.orders[0]).toMatchObject({ orderNumber: codOrderNumber, paymentStatus: "PAID", status: "DELIVERED" });
    const pub = await json(request(app2).post("/api/checkout/orders/lookup")).send({ orderNumber: codOrderNumber, token: codToken });
    expect(pub.body.order.shipment.trackingNumber).toBe("DL123456");
    await prisma2.$disconnect();
  });
});
