// PHASE 4 — REAL DATABASE TESTS for WhatsApp: webhooks, sign-in codes, order updates, bag reminders,
// campaigns, chatbot and API failures.   TEST_DATABASE_URL="mysql://…/bya_test" npm run test:db
// Meta's servers are replaced by tests/support/fakeMeta.ts (no network, nothing reaches WhatsApp);
// webhook signatures, the queue, dedupe keys and every database rule run for real.
import { execSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp, createServices } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import { createPrisma } from "../../src/db.js";
import { createLogger } from "../../src/logger.js";
import { createAdminUser } from "../../src/services/authService.js";
import { seedDatabase, type SeedCatalogue } from "../../src/services/seed.js";
import { WA, WA_ENV, createFakeMeta } from "../support/fakeMeta.js";

const DB = process.env["TEST_DATABASE_URL"];
if (!DB) throw new Error("TEST_DATABASE_URL is required for the real-database tests.");
if (!/test/i.test(new URL(DB).pathname)) throw new Error("Refusing to reset a database whose name doesn't contain 'test'.");

const ORIGIN = "https://shop.example";
const OWNER = { email: "owner4@test.beingyou", name: "Store Owner", password: "Saffron-Neem-Window-58" };
const ADMIN = { email: "admin4@test.beingyou", name: "Store Admin", password: "Cardamom-Lotus-River-37" };
const STAFF = { email: "staff4@test.beingyou", name: "Staff Member", password: "Marigold-Vetiver-Lamp-64" };
const catalogue = JSON.parse(readFileSync(path.resolve(__dirname, "../../prisma/seed/catalogue.json"), "utf8")) as SeedCatalogue;
const config = loadConfig({ NODE_ENV: "test", DATABASE_URL: DB, CORS_ORIGINS: ORIGIN, LOG_LEVEL: "silent", ORDER_LINK_SECRET: "a".repeat(40), PUBLIC_SITE_URL: ORIGIN, MEDIA_ROOT: "/tmp/bya-phase4-media", ...WA_ENV });
const SERUM = { productId: "bya-1069", variantId: "face-serum-1" };

let prisma: PrismaClient;
let app: ReturnType<typeof createApp>;
let services: ReturnType<typeof createServices>;
let meta: ReturnType<typeof createFakeMeta>;
let owner: string, adminCookie: string, staff: string;

const json = (r: request.Test) => r.set("Origin", ORIGIN).set("Content-Type", "application/json");
async function signIn(who: { email: string; password: string }) {
  const res = await json(request(app).post("/api/auth/login")).send({ email: who.email, password: who.password });
  expect(res.status).toBe(200);
  return (res.headers["set-cookie"] as unknown as string[])[0]!.split(";")[0]!;
}
const adminGet = (url: string, cookie = owner) => request(app).get(url).set("Cookie", cookie);
const adminPost = (url: string, body: object, cookie = owner, method: "post" | "put" | "patch" = "post") => json(request(app)[method](url)).set("Cookie", cookie).send(body);
const post = (url: string, body: object, cookie?: string) => { const r = json(request(app).post(url)); return (cookie ? r.set("Cookie", cookie) : r).send(body); };
const address = { line1: "12 Lake View Road, Flat 4B", line2: "", city: "Bengaluru", state: "Karnataka", pincode: "560001", type: "home" };
const placeCod = (phone: string, extra: Record<string, unknown> = {}) =>
  post("/api/checkout/orders", { checkoutKey: randomUUID(), lines: [{ ...SERUM, quantity: 1 }], contact: { name: "Asha Rao", email: `asha${phone}@example.com`, phone }, address, paymentMethod: "cod", ...extra });

const sign = (raw: string) => `sha256=${createHmac("sha256", WA_ENV.WHATSAPP_APP_SECRET).update(raw).digest("hex")}`;
const hook = (payload: object, signature?: string) => {
  const raw = JSON.stringify(payload);
  return request(app).post("/api/whatsapp/webhook").set("Content-Type", "application/json").set("X-Hub-Signature-256", signature ?? sign(raw)).send(raw);
};
const envelope = (value: object, field = "messages") => ({ object: "whatsapp_business_account", entry: [{ id: WA.wabaId, changes: [{ field, value: { messaging_product: "whatsapp", metadata: { display_phone_number: "919000000000", phone_number_id: WA.phoneNumberId }, ...value } }] }] });
const statusEvent = (id: string, status: string, ts: number, errors?: object[]) => envelope({ statuses: [{ id, status, timestamp: String(ts), recipient_id: "919876500001", ...(errors ? { errors } : {}) }] });
let inboundN = 0;
const inbound = (from: string, text: string) => envelope({ contacts: [{ wa_id: from, profile: { name: "Customer" } }], messages: [{ from, id: `wamid.IN${++inboundN}`, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: text } }] });
const drain = async () => { for (let i = 0; i < 5; i++) { await services.wa.processPendingEvents(); const r = await services.wa.processQueue(50); if (!r.attempted) break; } };

beforeAll(async () => {
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", { env: { ...process.env, DATABASE_URL: DB }, stdio: "pipe" });
  prisma = createPrisma(DB);
  await seedDatabase(prisma, catalogue);
  await createAdminUser(prisma, { ...OWNER, role: "owner" });
  await createAdminUser(prisma, { ...ADMIN, role: "admin" }, { allowAdditional: true });
  await createAdminUser(prisma, { ...STAFF, role: "staff" }, { allowAdditional: true });
  meta = createFakeMeta();
  const logger = createLogger("silent");
  services = createServices({ config, prisma, logger, gateway: null, graph: meta.graph });
  app = createApp({ config, prisma, logger, services });
  owner = await signIn(OWNER);
  adminCookie = await signIn(ADMIN);
  staff = await signIn(STAFF);
  await prisma.inventory.update({ where: { variantId: SERUM.variantId }, data: { quantity: 200, reserved: 0 } });
  await adminPost("/api/admin/settings/shipping", { enabled: true, flatFeePaise: 7900, freeAbovePaise: 99900, regions: { mode: "all_india", states: [], pincodePrefixes: [] }, estimateMinDays: 3, estimateMaxDays: 6, estimateNote: "", maxQtyPerLine: 10 }, owner, "put");
  await adminPost("/api/admin/settings/cod", { enabled: true, feePaise: 4900, minOrderPaise: null, maxOrderPaise: 300000, regions: { mode: "all_shipping", states: [], pincodePrefixes: [] } }, owner, "put");
});
afterAll(async () => { await prisma?.$disconnect(); });
// every request in these tests comes from one address; the per-network code limit has its own check above
beforeEach(async () => { meta.state.failures.length = 0; meta.state.tokenRevoked = false; await prisma.whatsAppOtp.updateMany({ data: { ip: null } }); });

describe("webhook: handshake, signatures, duplicates, delivery receipts", () => {
  it("answers Meta's handshake only with the right verify token", async () => {
    const ok = await request(app).get("/api/whatsapp/webhook").query({ "hub.mode": "subscribe", "hub.verify_token": WA_ENV.WHATSAPP_WEBHOOK_VERIFY_TOKEN, "hub.challenge": "1158201444" });
    expect(ok.status).toBe(200);
    expect(ok.text).toBe("1158201444");
    const bad = await request(app).get("/api/whatsapp/webhook").query({ "hub.mode": "subscribe", "hub.verify_token": "wrong-token-wrong-token-1", "hub.challenge": "1158201444" });
    expect(bad.status).toBe(403);
  });

  it("rejects a tampered or unsigned body and stores nothing", async () => {
    const payload = inbound("919876500001", "hi");
    const tampered = await hook(payload, sign(JSON.stringify({ ...payload, extra: 1 })));
    expect(tampered.status).toBe(401);
    const unsigned = await request(app).post("/api/whatsapp/webhook").set("Content-Type", "application/json").send(JSON.stringify(payload));
    expect(unsigned.status).toBe(401);
    expect(await prisma.whatsAppWebhookEvent.count()).toBe(0);
  });

  it("stores a delivery once; a retried delivery is acknowledged and not applied twice", async () => {
    const payload = inbound("919876500099", "Hello");
    const first = await hook(payload);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ received: true, stored: 1, duplicates: 0 });
    const again = await hook(payload);
    expect(again.body).toMatchObject({ received: true, stored: 0, duplicates: 1 });
    expect(await prisma.whatsAppMessage.count({ where: { direction: "INBOUND", phone: "919876500099" } })).toBe(1);
    await drain();
    // the greeting reply is sent once even though the delivery came twice
    expect(await prisma.whatsAppMessage.count({ where: { kind: "chatbot", phone: "919876500099" } })).toBe(1);
  });

  it("a status that arrives before the send saved its id is kept and applied afterwards; older 'sent' never overwrites 'delivered'", async () => {
    await placeCod("9876500001", { whatsapp: { orderUpdates: true, offers: false } });
    const id = meta.nextId();
    const t = Math.floor(Date.now() / 1000);
    expect((await hook(statusEvent(id, "delivered", t + 5))).status).toBe(200);
    expect((await prisma.whatsAppWebhookEvent.findFirstOrThrow({ where: { dedupeKey: { startsWith: `st:${id}:` } } })).outcome).toBe("deferred");
    await drain();
    const msg = await prisma.whatsAppMessage.findUniqueOrThrow({ where: { waMessageId: id } });
    expect(msg.purpose).toBe("cod_order_confirmation");
    expect(msg.state).toBe("DELIVERED");
    await hook(statusEvent(id, "sent", t));
    const after = await prisma.whatsAppMessage.findUniqueOrThrow({ where: { waMessageId: id } });
    expect(after.state).toBe("DELIVERED");
    expect(after.sentAt?.getTime()).toBe(t * 1000);
    expect(after.deliveredAt?.getTime()).toBe((t + 5) * 1000);
  });

  it("a failed delivery keeps Meta's error code and plain reason", async () => {
    const m = await prisma.whatsAppMessage.findFirstOrThrow({ where: { purpose: "cod_order_confirmation" } });
    await prisma.whatsAppMessage.update({ where: { id: m.id }, data: { state: "ACCEPTED", deliveredAt: null, sentAt: null } });
    await hook(statusEvent(m.waMessageId!, "failed", Math.floor(Date.now() / 1000), [{ code: 131026, title: "Message undeliverable" }]));
    const f = await prisma.whatsAppMessage.findUniqueOrThrow({ where: { id: m.id } });
    expect(f.state).toBe("FAILED");
    expect(f.errorCode).toBe(131026);
    expect(f.errorTitle).toMatch(/not on WhatsApp/);
  });
});

describe("WhatsApp sign-in codes", () => {
  const codeSent = () => meta.last()?.template?.components?.find((c) => c.type === "body")?.parameters[0]?.text ?? "";

  it("is unavailable (and sends nothing) while the sign-in template isn't approved", async () => {
    meta.state.templates = meta.state.templates.map((t) => (t.name === "login_otp" ? { ...t, status: "PENDING" } : t));
    services.wa.invalidate();
    expect((await request(app).get("/api/auth/whatsapp/status")).body).toMatchObject({ available: false });
    const before = meta.sent.length;
    const r = await post("/api/auth/whatsapp/request-otp", { phone: "9876511111" });
    expect(r.status).toBe(503);
    expect(r.body.error.code).toBe("whatsapp_otp_unavailable");
    expect(meta.sent.length).toBe(before);
    meta.reset();
    services.wa.invalidate();
    expect((await request(app).get("/api/auth/whatsapp/status")).body).toMatchObject({ available: true });
  });

  it("sends a code through the template, never stores it, and signs in once", async () => {
    const r = await post("/api/auth/whatsapp/request-otp", { phone: "98765 11111" });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ expiresInSeconds: 300, resendInSeconds: 60 });
    const sent = meta.last()!;
    expect(sent.to).toBe("919876511111");
    expect(sent.template?.name).toBe("login_otp");
    const code = codeSent();
    expect(code).toMatch(/^\d{6}$/);
    const row = await prisma.whatsAppOtp.findFirstOrThrow({ where: { phone: "919876511111" } });
    expect(row.codeHash).not.toContain(code);
    const log = await prisma.whatsAppMessage.findFirstOrThrow({ where: { kind: "otp", phone: "919876511111" } });
    expect(JSON.stringify(log.params)).not.toContain(code);

    const wrong = await post("/api/auth/whatsapp/verify-otp", { phone: "9876511111", code: code === "000000" ? "111111" : "000000" });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.details.attemptsLeft).toBe(4);
    const ok = await post("/api/auth/whatsapp/verify-otp", { phone: "9876511111", code });
    expect(ok.status).toBe(200);
    expect(ok.body.created).toBe(true);
    const cookie = (ok.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("bya_customer_session="))!.split(";")[0]!;
    const me = await request(app).get("/api/customer/me").set("Cookie", cookie);
    expect(me.body.customer.phone).toBe("9876511111");
    // the same code can't be used twice
    const replay = await post("/api/auth/whatsapp/verify-otp", { phone: "9876511111", code });
    expect(replay.status).toBe(400);
    expect(replay.body.error.code).toBe("otp_expired");
    // a shopper session can't reach the admin
    expect((await request(app).get("/api/admin/whatsapp/status").set("Cookie", cookie)).status).toBe(401);
  });

  it("limits resends: 60-second wait, then 3 codes an hour", async () => {
    const phone = "9876522222";
    expect((await post("/api/auth/whatsapp/request-otp", { phone })).status).toBe(200);
    const soon = await post("/api/auth/whatsapp/request-otp", { phone });
    expect(soon.status).toBe(429);
    const age = () => prisma.whatsAppOtp.updateMany({ where: { phone: `91${phone}` }, data: { createdAt: new Date(Date.now() - 2 * 60_000) } });
    await age();
    expect((await post("/api/auth/whatsapp/request-otp", { phone })).status).toBe(200);
    await age();
    expect((await post("/api/auth/whatsapp/request-otp", { phone })).status).toBe(200);
    await age();
    const fourth = await post("/api/auth/whatsapp/request-otp", { phone });
    expect(fourth.status).toBe(429);
    expect(fourth.body.error.message).toMatch(/Too many codes/);
  });

  it("locks the number for 15 minutes after 5 wrong codes, and an expired code never works", async () => {
    const phone = "9876533333";
    await post("/api/auth/whatsapp/request-otp", { phone });
    const code = codeSent();
    const bad = code === "000000" ? "999999" : "000000";
    for (let i = 0; i < 4; i++) expect((await post("/api/auth/whatsapp/verify-otp", { phone, code: bad })).status).toBe(400);
    expect((await post("/api/auth/whatsapp/verify-otp", { phone, code: bad })).status).toBe(429);
    expect((await post("/api/auth/whatsapp/verify-otp", { phone, code })).status).toBe(429);
    expect((await post("/api/auth/whatsapp/request-otp", { phone })).status).toBe(429);

    const p2 = "9876544444";
    await post("/api/auth/whatsapp/request-otp", { phone: p2 });
    const c2 = codeSent();
    await prisma.whatsAppOtp.updateMany({ where: { phone: `91${p2}` }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const late = await post("/api/auth/whatsapp/verify-otp", { phone: p2, code: c2 });
    expect(late.status).toBe(400);
    expect(late.body.error.code).toBe("otp_expired");
  });

  it("answers the same way for numbers with and without an account (no enumeration)", async () => {
    const known = await post("/api/auth/whatsapp/request-otp", { phone: "9876500001" });
    const unknown = await post("/api/auth/whatsapp/request-otp", { phone: "9876555555" });
    expect(known.status).toBe(unknown.status);
    expect(known.body).toEqual(unknown.body);
  });

  it("existing email accounts and Google sign-in still work", async () => {
    const reg = await post("/api/customer/register", { name: "Meera Iyer", email: "meera@example.com", password: "Rose-Water-Morning-73" });
    expect(reg.status).toBe(200);
    expect((await post("/api/customer/login", { email: "meera@example.com", password: "Rose-Water-Morning-73" })).status).toBe(200);
    expect((await request(app).get("/api/auth/google/status")).status).toBe(200);
  });
});

describe("order updates from real orders, never twice", () => {
  let orderId = "";
  let orderNumber = "";

  it("needs the shopper's consent: without it nothing is sent and the reason is recorded", async () => {
    const before = meta.sent.length;
    const r = await placeCod("9876566666");
    expect(r.status).toBe(201);
    await drain();
    expect(meta.sent.length).toBe(before);
    const m = await prisma.whatsAppMessage.findFirstOrThrow({ where: { orderId: r.body.order.id ?? undefined, phone: "919876566666" } });
    expect(m.state).toBe("SKIPPED");
    expect(m.errorTitle).toMatch(/hasn't agreed/);
  });

  it("COD confirmation carries the real order number and amount", async () => {
    const r = await placeCod("9876577777", { whatsapp: { orderUpdates: true, offers: false } });
    expect(r.status).toBe(201);
    orderNumber = r.body.order.orderNumber;
    orderId = (await prisma.order.findUniqueOrThrow({ where: { orderNumber } })).id;
    await drain();
    const s = meta.last()!;
    expect(s.template?.name).toBe("cod_order_confirmation");
    expect(meta.bodyParams(meta.sent.length - 1)).toEqual(["Asha", orderNumber, expect.stringMatching(/^₹/)]);
  });

  it("each step sends once; repeating a step sends nothing new", async () => {
    for (const to of ["CONFIRMED", "PROCESSING", "SHIPPED"]) expect((await adminPost(`/api/admin/orders/${orderId}/status`, { to })).status).toBe(200);
    expect((await adminPost(`/api/admin/orders/${orderId}/out-for-delivery`, {})).status).toBe(200);
    expect((await adminPost(`/api/admin/orders/${orderId}/out-for-delivery`, {})).status).toBe(200);
    expect((await adminPost(`/api/admin/orders/${orderId}/status`, { to: "DELIVERED" })).status).toBe(200);
    expect((await adminPost(`/api/admin/orders/${orderId}/status`, { to: "DELIVERED" })).status).toBe(409);
    await drain();
    const rows = await prisma.whatsAppMessage.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => r.purpose)).toEqual(["cod_order_confirmation", "order_confirmation", "order_packed", "order_shipped", "order_out_for_delivery", "order_delivered"]);
    expect(rows.every((r) => r.state === "ACCEPTED")).toBe(true);
    const shipped = meta.sent.find((s) => s.template?.name === "order_shipped")!;
    expect(shipped.template!.components![0]!.parameters[2]!.text).toMatch(new RegExp(`^${ORIGIN}/order/${orderNumber}#t=`));
    const panel = await adminGet(`/api/admin/orders/${orderId}/whatsapp`);
    expect(panel.body.messages).toHaveLength(6);
  });

  it("a cancellation sends the cancellation update", async () => {
    const r = await placeCod("9876577777");
    const id = (await prisma.order.findUniqueOrThrow({ where: { orderNumber: r.body.order.orderNumber } })).id;
    expect((await adminPost(`/api/admin/orders/${id}/cancel`, { reason: "Customer asked to cancel" })).status).toBe(200);
    await drain();
    expect((await prisma.whatsAppMessage.findMany({ where: { orderId: id } })).map((m) => m.purpose).sort()).toEqual(["cod_order_confirmation", "order_cancelled"]);
  });

  it("the customer can turn order updates off in their account", async () => {
    await post("/api/auth/whatsapp/request-otp", { phone: "9876588888" });
    const code = meta.last()!.template!.components![0]!.parameters[0]!.text;
    const ok = await post("/api/auth/whatsapp/verify-otp", { phone: "9876588888", code });
    const cookie = (ok.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("bya_customer_session="))!.split(";")[0]!;
    const put = await json(request(app).put("/api/customer/whatsapp")).set("Cookie", cookie).send({ orderUpdates: false, offers: false });
    expect(put.status).toBe(200);
    await placeCod("9876588888");
    await drain();
    const m = await prisma.whatsAppMessage.findFirstOrThrow({ where: { phone: "919876588888", kind: "order" } });
    expect(m.state).toBe("SKIPPED");
  });
});

describe("API failures: retry with backoff, permanent errors, revoked token", () => {
  it("a temporary Meta error is retried later; a permanent one is reported with its reason", async () => {
    meta.state.failures.push({ httpStatus: 500, code: 131000, title: "Something went wrong" });
    await placeCod("9876599999", { whatsapp: { orderUpdates: true, offers: false } });
    await drain();
    const m = await prisma.whatsAppMessage.findFirstOrThrow({ where: { phone: "919876599999", kind: "order" } });
    expect(m.state).toBe("QUEUED");
    expect(m.attempts).toBe(1);
    expect(m.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now() + 30_000);
    await prisma.whatsAppMessage.update({ where: { id: m.id }, data: { nextAttemptAt: new Date() } });
    await drain();
    expect((await prisma.whatsAppMessage.findUniqueOrThrow({ where: { id: m.id } })).state).toBe("ACCEPTED");

    meta.state.failures.push({ httpStatus: 400, code: 132001, title: "Template name does not exist in the translation" });
    const r = await placeCod("9876599999");
    await drain();
    const f = await prisma.whatsAppMessage.findFirstOrThrow({ where: { phone: "919876599999", kind: "order", state: "FAILED" } });
    expect(f.errorCode).toBe(132001);
    expect(f.errorTitle).toMatch(/isn't approved in this language/);
    const errs = await adminGet("/api/admin/whatsapp/errors");
    expect(errs.body.errors[0]).toMatchObject({ code: 132001 });
    // a failed update can be retried by staff — same row, so never a second copy
    const orderId = (await prisma.order.findUniqueOrThrow({ where: { orderNumber: r.body.order.orderNumber } })).id;
    expect((await adminPost(`/api/admin/orders/${orderId}/notify`, { purpose: "cod_order_confirmation" })).status).toBe(200);
    await drain();
    expect(await prisma.whatsAppMessage.count({ where: { orderId } })).toBe(1);
    expect((await prisma.whatsAppMessage.findFirstOrThrow({ where: { orderId } })).state).toBe("ACCEPTED");
  });

  it("an expired / revoked token is detected, shown, and pauses sending until fixed", async () => {
    meta.state.tokenRevoked = true;
    await placeCod("9876598888", { whatsapp: { orderUpdates: true, offers: false } });
    await drain();
    const m = await prisma.whatsAppMessage.findFirstOrThrow({ where: { phone: "919876598888", kind: "order" } });
    expect(m.state).toBe("QUEUED");
    expect(m.errorTitle).toMatch(/token/i);
    const st = await adminGet("/api/admin/whatsapp/status?refresh=1");
    expect(st.body.state).toBe("token-invalid");
    expect(st.body.error).toMatch(/expired or revoked/);
    expect((await request(app).get("/api/auth/whatsapp/status")).body.available).toBe(false);
    meta.state.tokenRevoked = false;
    const fixed = await adminGet("/api/admin/whatsapp/status?refresh=1");
    expect(fixed.body.state).toBe("connected");
    expect(fixed.body.displayPhoneNumber).toBe("+91 90000 00000");
    await prisma.whatsAppMessage.update({ where: { id: m.id }, data: { nextAttemptAt: new Date() } });
    await drain();
    expect((await prisma.whatsAppMessage.findUniqueOrThrow({ where: { id: m.id } })).state).toBe("ACCEPTED");
  });
});

describe("six-hour bag reminder", () => {
  const started = (key: string, phone: string, consent = true) =>
    post("/api/checkout/reminders/started", { checkoutKey: key, lines: [{ ...SERUM, quantity: 2 }], contact: { name: "Kavya Menon", phone }, reminderConsent: consent });
  const due = (key: string) => prisma.abandonedCheckout.update({ where: { checkoutKey: key }, data: { remindAt: new Date(Date.now() - 1000) } });

  it("is scheduled six hours after the last activity and not sent before", async () => {
    const key = randomUUID();
    const r = await started(key, "9876612345");
    expect(r.body.tracking).toBe(true);
    const c = await prisma.abandonedCheckout.findUniqueOrThrow({ where: { checkoutKey: key } });
    expect(c.remindAt.getTime() - c.lastActivityAt.getTime()).toBe(6 * 3_600_000);
    expect(c.subtotalPaise).toBeGreaterThan(0);
    expect((await services.carts.processDue()).queued).toBe(0);
  });

  it("sends exactly once with a working bag link, which reveals only the products", async () => {
    const key = randomUUID();
    await started(key, "9876612346");
    await due(key);
    expect((await services.carts.processDue()).queued).toBe(1);
    await drain();
    expect((await services.carts.processDue()).queued).toBe(0);
    const sent = meta.sent.filter((s) => s.to === "919876612346");
    expect(sent).toHaveLength(1);
    expect(sent[0]!.template!.name).toBe("abandoned_cart_reminder");
    const link = sent[0]!.template!.components![0]!.parameters[1]!.text;
    expect(link).toMatch(new RegExp(`^${ORIGIN}/cart\\?recover=`));
    const token = new URL(link).searchParams.get("recover")!;
    const rec = await post("/api/checkout/reminders/recover", { token });
    expect(rec.status).toBe(200);
    expect(rec.body).toEqual({ lines: [{ ...SERUM, quantity: 2 }] });
    expect((await post("/api/checkout/reminders/recover", { token: "x".repeat(32) })).status).toBe(404);
  });

  it("is cancelled when checkout completes, and never sent without consent or after STOP", async () => {
    const key = randomUUID();
    await started(key, "9876612347");
    const r = await post("/api/checkout/orders", { checkoutKey: key, lines: [{ ...SERUM, quantity: 1 }], contact: { name: "Kavya Menon", email: "kavya@example.com", phone: "9876612347" }, address, paymentMethod: "cod" });
    expect(r.status).toBe(201);
    expect((await prisma.abandonedCheckout.findUniqueOrThrow({ where: { checkoutKey: key } })).status).toBe("CONVERTED");

    const k2 = randomUUID();
    expect((await started(k2, "9876612348", false)).body.tracking).toBe(false);
    expect(await prisma.abandonedCheckout.count({ where: { checkoutKey: k2 } })).toBe(0);

    const k3 = randomUUID();
    await started(k3, "9876612349");
    await hook(inbound("919876612349", "STOP"));
    await drain();
    await due(k3);
    await services.carts.processDue();
    const c3 = await prisma.abandonedCheckout.findUniqueOrThrow({ where: { checkoutKey: k3 } });
    expect(c3.status).toBe("SKIPPED");
    expect(meta.sent.filter((s) => s.to === "919876612349" && s.type === "template")).toHaveLength(0);
  });

  it("survives a restart: a new set of services picks up the stored schedule", async () => {
    const key = randomUUID();
    await started(key, "9876612350");
    await due(key);
    const fresh = createServices({ config, prisma, logger: createLogger("silent"), gateway: null, graph: meta.graph });
    expect((await fresh.carts.processDue()).queued).toBe(1);
    await fresh.wa.processQueue();
    expect(meta.sent.filter((s) => s.to === "919876612350")).toHaveLength(1);
  });
});

describe("marketing campaigns need explicit approval", () => {
  let id = "";
  it("saving a draft sends nothing; staff can't create, admin can't approve", async () => {
    expect((await adminPost("/api/admin/whatsapp/campaigns", { name: "Launch", templateName: "new_launch", language: "en", segment: { kind: "all_opted_in" }, params: ["{name}", "{store_url}"], maxRecipients: 100 }, staff)).status).toBe(403);
    const before = meta.sent.length;
    const c = await adminPost("/api/admin/whatsapp/campaigns", { name: "Launch", templateName: "new_launch", language: "en", segment: { kind: "all_opted_in" }, params: ["{name}", "{store_url}"], maxRecipients: 100 }, adminCookie);
    expect(c.status).toBe(201);
    id = c.body.campaign.id;
    await drain();
    expect(meta.sent.length).toBe(before);
    expect((await adminPost(`/api/admin/whatsapp/campaigns/${id}/approve`, { confirmRecipients: 1 }, adminCookie)).status).toBe(403);
  });

  it("the owner approves the exact audience; opted-out customers are excluded; report counts only real results", async () => {
    const d = await adminGet(`/api/admin/whatsapp/campaigns/${id}`);
    const n = d.body.audience.eligible as number;
    expect(n).toBeGreaterThan(0);
    // 9876612349 replied STOP earlier
    expect(d.body.audience.optedOut).toBeGreaterThanOrEqual(1);
    const wrong = await adminPost(`/api/admin/whatsapp/campaigns/${id}/approve`, { confirmRecipients: n + 1 });
    expect(wrong.status).toBe(409);
    expect(wrong.body.error.code).toBe("audience_changed");
    const ok = await adminPost(`/api/admin/whatsapp/campaigns/${id}/approve`, { confirmRecipients: n });
    expect(ok.status).toBe(200);
    expect(ok.body.campaign.status).toBe("APPROVED");
    await drain();
    const sent = meta.sent.filter((s) => s.template?.name === "new_launch");
    expect(sent.map((s) => s.to)).not.toContain("919876612349");
    await services.campaigns.completeFinished();
    const rep = (await adminGet(`/api/admin/whatsapp/campaigns/${id}`)).body.campaign;
    expect(rep.status).toBe("COMPLETED");
    expect(rep.report.accepted + rep.report.skipped).toBe(n);
    expect(rep.report.read).toBe(0);
    expect(rep.report.delivered).toBe(0);
    expect((await adminPost(`/api/admin/whatsapp/campaigns/${id}/approve`, { confirmRecipients: n })).status).toBe(409);
  });

  it("a campaign approved for later can be cancelled before it sends", async () => {
    const c = await adminPost("/api/admin/whatsapp/campaigns", { name: "Later", templateName: "new_launch", language: "en", segment: { kind: "all_opted_in" }, params: ["{name}", "{store_url}"], maxRecipients: 100, scheduledAt: new Date(Date.now() + 86_400_000).toISOString() });
    const cid = c.body.campaign.id;
    const n = (await adminGet(`/api/admin/whatsapp/campaigns/${cid}`)).body.audience.eligible;
    expect((await adminPost(`/api/admin/whatsapp/campaigns/${cid}/approve`, { confirmRecipients: n })).status).toBe(200);
    const before = meta.sent.length;
    await drain();
    expect(meta.sent.length).toBe(before);
    expect((await adminPost(`/api/admin/whatsapp/campaigns/${cid}/cancel`, {})).status).toBe(200);
    expect(await prisma.whatsAppMessage.count({ where: { campaignId: cid, state: "QUEUED" } })).toBe(0);
  });
});

describe("chatbot answers only from store records", () => {
  const replyTo = async (from: string, text: string) => {
    await hook(inbound(from, text));
    await drain();
    return (await prisma.whatsAppMessage.findFirstOrThrow({ where: { phone: from, kind: "chatbot" }, orderBy: { createdAt: "desc" } })).body ?? "";
  };

  it("shares an order's status only with the number that placed it", async () => {
    const o = await prisma.order.findFirstOrThrow({ where: { phone: "9876577777", status: "DELIVERED" } });
    expect(await replyTo("919876577777", `where is my order ${o.orderNumber}?`)).toMatch(new RegExp(`${o.orderNumber}.*Delivered`));
    const other = await replyTo("919876500777", `status of ${o.orderNumber}`);
    expect(other).toMatch(/couldn't find order/);
    expect(other).not.toMatch(/Delivered/);
  });

  it("uses real shipping settings, policy links and catalogue prices", async () => {
    expect(await replyTo("919876500778", "how much is shipping?")).toMatch(/₹79.*free on orders above ₹999/);
    expect(await replyTo("919876500779", "I want a refund")).toMatch(new RegExp(`${ORIGIN}/refund-policy`));
    expect(await replyTo("919876500780", "do you have face serum")).toMatch(/Serum.*₹\d+.*\/product\//s);
  });

  it("hands unclear questions to a person and shows them in the inbox", async () => {
    await replyTo("919876500781", "my parcel box was open when it came");
    const inbox = await adminGet("/api/admin/whatsapp/inbox");
    const thread = inbox.body.threads.find((t: { phone: string }) => t.phone === "+919876500781");
    expect(thread).toBeTruthy();
    expect(thread.canReply).toBe(true);
    const reply = await adminPost(`/api/admin/whatsapp/inbox/${thread.key}/reply`, { text: "Sorry about that — we're sending a replacement." });
    expect(reply.status).toBe(200);
    expect(meta.last()).toMatchObject({ to: "919876500781", type: "text" });
    expect((await adminGet("/api/admin/whatsapp/inbox")).body.threads.find((t: { phone: string }) => t.phone === "+919876500781")).toBeUndefined();
  });
});

describe("admin access and diagnostics", () => {
  it("staff can view but not change settings; nobody sees the token or a sign-in code", async () => {
    const st = await adminGet("/api/admin/whatsapp/status?refresh=1", staff);
    expect(st.status).toBe(200);
    expect(st.body.state).toBe("connected");
    expect(JSON.stringify(st.body)).not.toContain(WA_ENV.WHATSAPP_ACCESS_TOKEN);
    expect(JSON.stringify(st.body)).not.toContain(WA_ENV.WHATSAPP_APP_SECRET);
    expect((await adminPost("/api/admin/whatsapp/templates", { otp: { name: "login_otp", language: "en" } }, staff, "put")).status).toBe(403);
    const msgs = await adminGet("/api/admin/whatsapp/messages?kind=otp", staff);
    expect(msgs.status).toBe(200);
    expect(msgs.body.messages.length).toBeGreaterThan(0);
    expect(msgs.body.messages.every((m: { text: string | null }) => m.text === null)).toBe(true);
    const tpl = await adminGet("/api/admin/whatsapp/templates");
    expect(tpl.body.purposes.find((p: { purpose: string }) => p.purpose === "otp").ready).toBe(true);
  });

  it("integration checks: the test send goes only to an authorized number", async () => {
    const no = await adminPost("/api/admin/whatsapp/tests", { check: "test-message", recipient: "9876512340" });
    expect(no.body.passed).toBe(false);
    expect(no.body.detail).toMatch(/WHATSAPP_TEST_RECIPIENTS/);
    const yes = await adminPost("/api/admin/whatsapp/tests", { check: "test-message", recipient: "9876500001" });
    expect(yes.body.passed).toBe(true);
    expect(meta.last()).toMatchObject({ to: "919876500001", template: { name: "hello_world" } });
    for (const check of ["webhook-signature", "duplicates", "token-expired", "webhook-verify"]) {
      expect((await adminPost("/api/admin/whatsapp/tests", { check, recipient: "" })).body.passed).toBe(true);
    }
  });
});
