// PHASE 3 — REAL DATABASE TESTS for shopper accounts, stored files, customer stories, website wording
// and the pre-launch checklist.   TEST_DATABASE_URL="mysql://…/bya_test" npm run test:db
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
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

const DB = process.env["TEST_DATABASE_URL"];
if (!DB) throw new Error("TEST_DATABASE_URL is required for the real-database tests.");
if (!/test/i.test(new URL(DB).pathname)) throw new Error("Refusing to reset a database whose name doesn't contain 'test'.");

const ORIGIN = "https://shop.example";
const MEDIA = "/tmp/bya-phase3-media";
const OWNER = { email: "owner3@test.beingyou", name: "Store Owner", password: "Neem-Tulsi-Cedar-41" };
const catalogue = JSON.parse(readFileSync(path.resolve(__dirname, "../../prisma/seed/catalogue.json"), "utf8")) as SeedCatalogue;

// three wrong answers lock an account, so the lockout test doesn't need five goes
const config = loadConfig({
  NODE_ENV: "test", DATABASE_URL: DB, CORS_ORIGINS: ORIGIN, LOG_LEVEL: "silent",
  ORDER_LINK_SECRET: "a".repeat(40), PUBLIC_SITE_URL: "https://shop.example",
  MEDIA_ROOT: MEDIA, LOGIN_MAX_ATTEMPTS: "3",
});

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==", "base64");
const SHIPPING = { enabled: true, flatFeePaise: 7900, freeAbovePaise: 99900, regions: { mode: "all_india", states: [], pincodePrefixes: [] }, estimateMinDays: 3, estimateMaxDays: 6, estimateNote: "", maxQtyPerLine: 10 };
const COD = { enabled: true, feePaise: 4900, minOrderPaise: null, maxOrderPaise: 300000, regions: { mode: "all_shipping", states: [], pincodePrefixes: [] } };

let prisma: PrismaClient;
let app: ReturnType<typeof createApp>;
let owner: string;
let shopper = "";
let shopperEmail = "asha@example.com";

const json = (r: request.Test) => r.set("Origin", ORIGIN).set("Content-Type", "application/json");
const cookieOf = (res: request.Response) => (res.headers["set-cookie"] as unknown as string[])[0]!.split(";")[0]!;
const adminGet = (url: string, cookie = owner) => request(app).get(url).set("Cookie", cookie);
const adminPost = (url: string, body: object, cookie = owner, method: "post" | "put" | "patch" = "post") => json(request(app)[method](url)).set("Cookie", cookie).send(body);
const shopGet = (url: string, cookie?: string) => (cookie ? request(app).get(url).set("Cookie", cookie) : request(app).get(url));
const shopPost = (url: string, body: object, cookie?: string) => {
  const r = json(request(app).post(url));
  return (cookie ? r.set("Cookie", cookie) : r).send(body);
};
const upload = (query: string, file: Buffer, name: string, cookie = owner) =>
  request(app).post(`/api/admin/media/upload${query}`).set("Cookie", cookie).set("Origin", ORIGIN).attach("file", file, name);

/** the newest link the server wrote for itself — the same one a shopper would click in their email */
function newestLink(kind: "verify-email" | "reset-password") {
  const dir = path.join(MEDIA, "outbox");
  const files = readdirSync(dir).map((f) => ({ f, at: readFileSync(path.join(dir, f), "utf8") }))
    .filter((x) => x.at.includes(`${kind}?token=`))
    .sort((a, b) => b.at.localeCompare(a.at));
  const hit = files[0];
  if (!hit) throw new Error(`no ${kind} link was written`);
  return hit.at.match(new RegExp(`${kind}\\?token=([A-Za-z0-9_-]+)`))![1]!;
}

beforeAll(async () => {
  rmSync(MEDIA, { recursive: true, force: true });
  mkdirSync(MEDIA, { recursive: true });
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", { env: { ...process.env, DATABASE_URL: DB }, stdio: "pipe" });
  prisma = createPrisma(DB);
  await seedDatabase(prisma, catalogue);
  await createAdminUser(prisma, { ...OWNER, role: "owner" });
  const logger = createLogger("silent");
  const services = createServices({ config, prisma, logger, gateway: null });
  app = createApp({ config, prisma, logger, services });
  const login = await json(request(app).post("/api/auth/login")).send({ email: OWNER.email, password: OWNER.password });
  owner = cookieOf(login);
});

afterAll(async () => {
  await prisma.$disconnect();
  rmSync(MEDIA, { recursive: true, force: true });
});

describe("1. shopper accounts", () => {
  it("registers, sets a shopper cookie and reads the account back", async () => {
    const res = await shopPost("/api/customer/register", { name: "Asha Rao", email: shopperEmail, phone: "9812345678", password: "Tulsi-Nectar-Dew-19" });
    expect(res.status).toBe(200);
    expect(res.body.customer).toMatchObject({ name: "Asha Rao", email: shopperEmail, emailVerified: false, hasPassword: true, signInMethod: "password" });
    expect(res.body.emailConfirmation).toBe("queued");
    shopper = cookieOf(res);
    const me = await shopGet("/api/customer/me", shopper);
    expect(me.status).toBe(200);
    expect(me.body.customer.email).toBe(shopperEmail);
  });

  it("refuses a password that is too short and an email that is already taken", async () => {
    const short = await shopPost("/api/customer/register", { name: "Short One", email: "short@example.com", password: "dewdrops" });
    expect(short.status).toBe(400);
    const taken = await shopPost("/api/customer/register", { name: "Asha Again", email: shopperEmail, password: "Tulsi-Nectar-Dew-19" });
    expect(taken.status).toBe(409);
  });

  it("confirms the email with the link the server wrote, once only", async () => {
    const token = newestLink("verify-email");
    const ok = await shopPost("/api/customer/verify-email", { token });
    expect(ok.status).toBe(200);
    expect(ok.body.customer.emailVerified).toBe(true);
    const again = await shopPost("/api/customer/verify-email", { token });
    expect(again.status).toBe(400);
  });

  it("says the same thing for an unknown email and never issues a link for it", async () => {
    const res = await shopPost("/api/customer/forgot-password", { email: "ghost@example.com" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ accepted: true });
    expect(await prisma.customerToken.count({ where: { purpose: "RESET_PASSWORD", customer: { email: "ghost@example.com" } } })).toBe(0);
  });

  it("resets the password from the emailed link, then signs every other device out", async () => {
    const asked = await shopPost("/api/customer/forgot-password", { email: shopperEmail });
    expect(asked.body).toEqual({ accepted: true });
    const token = newestLink("reset-password");
    const done = await shopPost("/api/customer/reset-password", { token, password: "Cedar-Bark-Ritual-33" });
    expect(done.status).toBe(200);
    const stale = await shopGet("/api/customer/me", shopper);
    expect(stale.status).toBe(401);
    const old = await shopPost("/api/customer/login", { email: shopperEmail, password: "Tulsi-Nectar-Dew-19" });
    expect(old.status).toBe(401);
    const fresh = await shopPost("/api/customer/login", { email: shopperEmail, password: "Cedar-Bark-Ritual-33" });
    expect(fresh.status).toBe(200);
    shopper = cookieOf(fresh);
    const reuse = await shopPost("/api/customer/reset-password", { token, password: "Another-Good-Password-7" });
    expect(reuse.status).toBe(400);
  });

  it("changes the password only with the current one", async () => {
    const wrong = await shopPost("/api/customer/change-password", { currentPassword: "Not-My-Current-Password-1", password: "Jasmine-Rain-Shadow-55" }, shopper);
    expect(wrong.status).toBe(401);
    const right = await shopPost("/api/customer/change-password", { currentPassword: "Cedar-Bark-Ritual-33", password: "Jasmine-Rain-Shadow-55" }, shopper);
    expect(right.status).toBe(200);
    const again = await shopPost("/api/customer/login", { email: shopperEmail, password: "Jasmine-Rain-Shadow-55" });
    expect(again.status).toBe(200);
    shopper = cookieOf(again);
  });

  it("locks an account after three wrong answers, even for the right one", async () => {
    await shopPost("/api/customer/register", { name: "Locked Person", email: "lock@example.com", password: "Banyan-Root-Monsoon-8" });
    for (let i = 0; i < 3; i++) {
      const bad = await shopPost("/api/customer/login", { email: "lock@example.com", password: "wrong-answer-here" });
      expect(bad.status).toBe(401);
    }
    const locked = await shopPost("/api/customer/login", { email: "lock@example.com", password: "Banyan-Root-Monsoon-8" });
    expect(locked.status).toBe(429);
    expect(locked.body.message ?? JSON.stringify(locked.body)).toMatch(/Too many attempts/);
  });

  it("keeps shopper and staff sessions apart in both directions", async () => {
    const asAdmin = await shopGet("/api/admin/orders", shopper);
    expect(asAdmin.status).toBe(401);
    const asShopper = await shopGet("/api/customer/me", owner);
    expect(asShopper.status).toBe(401);
  });

  it("saves and removes addresses", async () => {
    const made = await shopPost("/api/customer/addresses", { label: "Home", name: "Asha Rao", phone: "9812345678", line1: "9 Camomile Lane", city: "Bengaluru", state: "Karnataka", pincode: "560001", isDefault: true }, shopper);
    expect(made.status).toBe(200);
    const list = await shopGet("/api/customer/addresses", shopper);
    expect(list.body.addresses).toHaveLength(1);
    expect(list.body.addresses[0]).toMatchObject({ city: "Bengaluru", pincode: "560001", isDefault: true });
    const gone = await shopPost(`/api/customer/addresses/${list.body.addresses[0].id}/delete`, {}, shopper);
    expect(gone.status).toBe(200);
    expect((await shopGet("/api/customer/addresses", shopper)).body.addresses).toHaveLength(0);
  });

  it("signs out everywhere and refuses the old cookie", async () => {
    const out = await shopPost("/api/customer/sign-out-everywhere", {}, shopper);
    expect(out.status).toBe(200);
    expect((await shopGet("/api/customer/me", shopper)).status).toBe(401);
    const back = await shopPost("/api/customer/login", { email: shopperEmail, password: "Jasmine-Rain-Shadow-55" });
    shopper = cookieOf(back);
    expect(back.status).toBe(200);
  });
});

describe("2. orders in an account", () => {
  const contact = { name: "Asha Rao", email: shopperEmail, phone: "9812345678" };
  const address = { line1: "9 Camomile Lane", line2: "", city: "Bengaluru", state: "Karnataka", pincode: "560001", type: "home" };

  it("places a guest order and brings it into the account with the link key", async () => {
    await adminPost("/api/admin/settings/shipping", SHIPPING, owner, "put");
    await adminPost("/api/admin/settings/cod", COD, owner, "put");
    await prisma.inventory.update({ where: { variantId: "face-serum-1" }, data: { quantity: 50, reserved: 0 } });
    const placed = await shopPost("/api/checkout/orders", {
      checkoutKey: randomUUID(),
      lines: [{ productId: "bya-1069", variantId: "face-serum-1", quantity: 1, seenUnitPrice: 680 }],
      contact, address, paymentMethod: "cod",
    });
    expect(placed.status).toBe(201);
    const orderNumber = placed.body.order.orderNumber as string;
    const key = placed.body.accessToken as string;
    expect(key.length).toBeGreaterThan(20);

    const list = await shopGet("/api/customer/orders", shopper);
    expect(list.body.orders.map((o: { orderNumber: string }) => o.orderNumber)).toContain(orderNumber);

    const claimed = await shopPost("/api/customer/orders/claim", { orderNumber, token: key }, shopper);
    expect(claimed.status).toBe(200);
    expect(claimed.body.order.orderNumber).toBe(orderNumber);

    const tampered = await shopPost("/api/customer/orders/claim", { orderNumber, token: `${key.slice(0, -4)}AAAA` }, shopper);
    expect(tampered.status).toBe(404);

    const other = await shopPost("/api/customer/register", { name: "Nobody Else", email: "nobody@example.com", password: "Marigold-Stem-Sulphur-4" });
    const otherCookie = cookieOf(other);
    const steal = await shopPost("/api/customer/orders/claim", { orderNumber, token: key }, otherCookie);
    expect(steal.status).toBe(403);

    const detail = await shopGet(`/api/customer/orders/${orderNumber}`, shopper);
    expect(detail.status).toBe(200);
    expect(detail.body.order.orderNumber).toBe(orderNumber);
    expect(detail.body.order).not.toHaveProperty("accessKey");
  });
});

describe("3. stored files", () => {
  let mediaId = "";
  let mediaUrl = "";

  it("stores a real picture and serves it back, including a byte range", async () => {
    const up = await upload("?kind=PRODUCT_IMAGE&productId=bya-1069", PNG, "serum-shot.png");
    expect(up.status).toBe(200);
    mediaId = up.body.media.id;
    mediaUrl = up.body.media.url;
    expect(mediaUrl).toBe(`/api/media/${mediaId}`);
    expect(up.body.media).toMatchObject({ mime: "image/png", bytes: PNG.length });

    const got = await request(app).get(mediaUrl);
    expect(got.status).toBe(200);
    expect(got.headers["content-type"]).toContain("image/png");
    expect(got.body).toEqual(PNG);

    const part = await request(app).get(mediaUrl).set("Range", "bytes=0-3");
    expect(part.status).toBe(206);
    expect(part.headers["content-range"]).toBe(`bytes 0-3/${PNG.length}`);
    expect(part.body).toEqual(PNG.subarray(0, 4));
  });

  it("refuses a file that isn't really a picture, and a picture sent as a story video", async () => {
    const fake = await upload("?kind=PRODUCT_IMAGE", Buffer.from("this is a plain text file, not an image"), "serum.png");
    expect(fake.status).toBe(400);
    expect(fake.body.message ?? JSON.stringify(fake.body)).toMatch(/isn't a supported image or video/);
    const wrongKind = await upload("?kind=REVIEW_VIDEO", PNG, "story.png");
    expect(wrongKind.status).toBe(400);
    // a product picture has to say which product it belongs to, and that product has to exist
    const loose = await upload("?kind=PRODUCT_IMAGE", PNG, "loose.png");
    expect(loose.status).toBe(400);
    expect(JSON.stringify(loose.body)).toMatch(/which product/);
    const ghost = await upload("?kind=PRODUCT_IMAGE&productId=no-such-product", PNG, "ghost.png");
    expect(ghost.status).toBe(404);
  });

  it("refuses a file that is too large", async () => {
    const big = Buffer.alloc(config.media.maxImageBytes + 1024, 7);
    const res = await upload("?kind=PRODUCT_IMAGE", big, "huge.png");
    expect(res.status).toBe(400);
    expect(res.body.message ?? JSON.stringify(res.body)).toMatch(/too large/);
  });

  it("adds an uploaded picture to a product and hides it again when archived", async () => {
    const up = await upload("?kind=PRODUCT_IMAGE&attach=true&productId=bya-1069", PNG, "serum-2.png");
    expect(up.status).toBe(200);
    const id = up.body.media.id;
    expect(await prisma.productImage.count({ where: { productId: "bya-1069", url: `/api/media/${id}` } })).toBe(1);

    const beforePurge = await adminPost(`/api/admin/media/${id}/purge`, {});
    expect(beforePurge.status).toBe(409);

    const archived = await adminPost(`/api/admin/media/${id}/delete`, {});
    expect(archived.status).toBe(200);
    expect((await request(app).get(`/api/media/${id}`)).status).toBe(404);
    expect(await prisma.productImage.count({ where: { productId: "bya-1069", url: `/api/media/${id}` } })).toBe(0);

    const purged = await adminPost(`/api/admin/media/${id}/purge`, {});
    expect(purged.status).toBe(200);
    expect(await prisma.mediaAsset.count({ where: { id } })).toBe(0);
  });

  it("keeps a story picture private until the story is published with consent", async () => {
    const story = await adminPost("/api/admin/reviews", {
      authorName: "Meera J.", body: "My hair felt lighter after four washes.", rating: 5, category: "Hair", city: "Pune",
      verifiedPurchase: false, consentGiven: false, status: "PENDING",
    });
    expect(story.status).toBe(200);
    const reviewId = story.body.review.id as string;

    const up = await upload(`?kind=REVIEW_PHOTO&reviewId=${reviewId}`, PNG, "meera.png");
    expect(up.status).toBe(200);
    const url = up.body.media.url as string;
    expect((await request(app).get(url)).status).toBe(404);
    expect((await adminGet(url)).status).toBe(200);

    const published = await adminPost(`/api/admin/reviews/${reviewId}`, { verifiedPurchase: true, consentGiven: true, status: "PUBLISHED" }, owner, "patch");
    expect(published.status).toBe(200);
    expect((await request(app).get(url)).status).toBe(200);
  });
});

describe("4. stories, wording and the checklist", () => {
  it("won't publish a story without consent and a verified purchase", async () => {
    const res = await adminPost("/api/admin/reviews", { authorName: "Rhea K.", body: "The toner is light and smells fresh.", status: "PUBLISHED", consentGiven: true, verifiedPurchase: false });
    expect(res.status).toBe(409);
    expect(res.body.message ?? JSON.stringify(res.body)).toMatch(/consent/);
  });

  it("shows only published, consented, verified stories to shoppers", async () => {
    const before = await request(app).get("/api/reviews");
    expect(before.status).toBe(200);
    const names = before.body.reviews.map((r: { authorName: string }) => r.authorName);
    expect(names).toContain("Meera J.");
    expect(names).not.toContain("Rhea K.");
    const home = await request(app).get("/api/reviews?placement=home");
    expect(home.status).toBe(200);
    expect(home.body.reviews).toHaveLength(0);
  });

  it("saves website wording and serves it to the shop", async () => {
    const saved = await adminPost("/api/admin/content", { items: { "home.hero": { title: "Plant care, made simple" }, "content.reviewed": true } }, owner, "put");
    if (saved.status !== 200) console.log("content save failed", saved.status, JSON.stringify(saved.body));
    expect(saved.status).toBe(200);
    const pub = await request(app).get("/api/content");
    expect(pub.body.content).toMatchObject({ "home.hero": { title: "Plant care, made simple" }, "content.reviewed": true });
    const removed = await adminPost("/api/admin/content/home.hero/delete", {});
    expect(removed.status).toBe(200);
    expect((await request(app).get("/api/content")).body.content).not.toHaveProperty("home.hero");
  });

  it("works the checklist out from live data, not from ticks", async () => {
    const first = await adminGet("/api/admin/approvals");
    expect(first.status).toBe(200);
    const item = (key: string) => first.body.items.find((i: { key: string }) => i.key === key);
    expect(item("email").confirmed).toBe(false);
    expect(item("google").confirmed).toBe(false);
    expect(item("razorpay").confirmed).toBe(false);
    expect(item("stories").confirmed).toBe(true);
    expect(item("content").confirmed).toBe(true);
    expect(item("media").confirmed).toBe(true);

    const after = await adminPost("/api/admin/settings/shipping", { ...SHIPPING, enabled: false }, owner, "put");
    expect(after.status).toBe(200);
    const second = await adminGet("/api/admin/approvals");
    expect(second.body.items.find((i: { key: string }) => i.key === "shipping").confirmed).toBe(false);
    await adminPost("/api/admin/settings/shipping", SHIPPING, owner, "put");
    const third = await adminGet("/api/admin/approvals");
    expect(third.body.items.find((i: { key: string }) => i.key === "shipping").confirmed).toBe(true);
    expect(third.body.confirmed).toBeGreaterThan(first.body.confirmed - 1);
  });

  it("keeps Google sign-in off until the server has credentials", async () => {
    const status = await request(app).get("/api/auth/google/status");
    expect(status.status).toBe(200);
    expect(status.body).toEqual({ configured: false });
    const start = await request(app).get("/api/auth/google/start").set("Origin", ORIGIN);
    expect(start.status).toBeGreaterThanOrEqual(400);
  });

  it("removes an account but keeps the store's own sales record", async () => {
    const ordersBefore = await prisma.order.count();
    const gone = await shopPost("/api/customer/delete-account", {}, shopper);
    expect(gone.status).toBe(200);
    expect((await shopGet("/api/customer/me", shopper)).status).toBe(401);
    const back = await shopPost("/api/customer/login", { email: shopperEmail, password: "Jasmine-Rain-Shadow-55" });
    expect(back.status).toBe(401);
    expect(await prisma.order.count()).toBe(ordersBefore);
  });
});
