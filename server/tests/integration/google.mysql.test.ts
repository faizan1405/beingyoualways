// REAL DATABASE TESTS for sign-in with Google. Google itself is replaced by a stand-in that signs ID
// tokens with a key generated here (Google's token and key endpoints are the only requests stubbed),
// so everything on the store's side — flow cookie, PKCE, token checks, account linking, sessions and
// redirects — runs for real against MySQL. This is NOT a test of Google's own servers.
//   TEST_DATABASE_URL="mysql://…/bya_test" npm run test:db
import { execSync } from "node:child_process";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createApp, createServices } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import { createPrisma } from "../../src/db.js";
import { createLogger } from "../../src/logger.js";
import { createAdminUser } from "../../src/services/authService.js";
import { seedDatabase, type SeedCatalogue } from "../../src/services/seed.js";

const DB = process.env["TEST_DATABASE_URL"];
if (!DB) throw new Error("TEST_DATABASE_URL is required for the real-database tests.");
if (!/test/i.test(new URL(DB).pathname)) throw new Error("Refusing to reset a database whose name doesn't contain 'test'.");

const SITE = "https://shop.example";
const MEDIA = "/tmp/bya-google-media";
const CLIENT_ID = "1234567890-storetest.apps.googleusercontent.com";
const CLIENT_SECRET = "test-google-client-secret";
const REDIRECT = "https://api.shop.example/api/auth/google/callback";
const catalogue = JSON.parse(readFileSync(path.resolve(__dirname, "../../prisma/seed/catalogue.json"), "utf8")) as SeedCatalogue;

const config = loadConfig({
  NODE_ENV: "test", DATABASE_URL: DB, CORS_ORIGINS: SITE, LOG_LEVEL: "silent",
  ORDER_LINK_SECRET: "a".repeat(40), PUBLIC_SITE_URL: SITE, MEDIA_ROOT: MEDIA,
  AUTH_GOOGLE_ID: CLIENT_ID, AUTH_GOOGLE_SECRET: CLIENT_SECRET, GOOGLE_REDIRECT_URL: REDIRECT, AUTH_SECRET: "g".repeat(48),
});

// ── the stand-in for Google ──
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
interface Pending { nonce: string; challenge: string; who: { sub: string; email: string; verified?: boolean; name?: string } }
const issued = new Map<string, Pending>(); // authorization code → what Google would vouch for
const tokenRequests: URLSearchParams[] = [];
const jwt = (claims: object) => {
  const h = Buffer.from(JSON.stringify({ alg: "RS256", kid: "k1" })).toString("base64url");
  const p = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${h}.${p}.${sign("RSA-SHA256", Buffer.from(`${h}.${p}`), privateKey).toString("base64url")}`;
};
const realFetch = globalThis.fetch;
vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
  const url = String(input);
  if (url === "https://www.googleapis.com/oauth2/v3/certs") return new Response(JSON.stringify({ keys: [jwk] }));
  if (url === "https://oauth2.googleapis.com/token") {
    const body = new URLSearchParams(String(init?.body ?? ""));
    tokenRequests.push(body);
    const p = issued.get(body.get("code") ?? "");
    const verifierOk = p && createHash("sha256").update(body.get("code_verifier") ?? "").digest("base64url") === p.challenge;
    if (!p || !verifierOk || body.get("client_secret") !== CLIENT_SECRET || body.get("redirect_uri") !== REDIRECT) {
      return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
    }
    issued.delete(body.get("code")!); // codes are single-use, like Google's
    return new Response(JSON.stringify({
      id_token: jwt({ iss: "https://accounts.google.com", aud: CLIENT_ID, exp: Math.floor(Date.now() / 1000) + 300, nonce: p.nonce,
        sub: p.who.sub, email: p.who.email, email_verified: p.who.verified ?? true, name: p.who.name ?? "Google Shopper" }),
    }));
  }
  return realFetch(input, init);
});

let prisma: PrismaClient;
let app: ReturnType<typeof createApp>;
const setCookies = (res: request.Response) => (res.headers["set-cookie"] as unknown as string[] | undefined) ?? [];
const cookieNamed = (res: request.Response, name: string) => {
  const c = setCookies(res).find((x) => x.startsWith(`${name}=`) && !x.startsWith(`${name}=;`));
  return c ? c.split(";")[0]! : null;
};

/** Runs the whole browser round trip: /start → "Google" → /callback, returning the callback response. */
async function googleSignIn(who: Pending["who"], tweak?: { state?: string; cookie?: string | null; query?: string }) {
  const start = await request(app).get("/api/auth/google/start");
  expect(start.status).toBe(302);
  const to = new URL(start.headers["location"] as string);
  const flowCookie = cookieNamed(start, "bya_google_flow");
  const code = `code-${Math.random().toString(36).slice(2)}`;
  issued.set(code, { nonce: to.searchParams.get("nonce")!, challenge: to.searchParams.get("code_challenge")!, who });
  const state = tweak?.state ?? to.searchParams.get("state")!;
  const req = request(app).get(`/api/auth/google/callback?code=${code}&state=${encodeURIComponent(state)}${tweak?.query ?? ""}`);
  const cookie = tweak && "cookie" in tweak ? tweak.cookie : flowCookie;
  return cookie ? req.set("Cookie", cookie) : req;
}
const landing = (res: request.Response) => new URL(res.headers["location"] as string);
const session = (res: request.Response) => cookieNamed(res, config.customer.cookie);

beforeAll(async () => {
  rmSync(MEDIA, { recursive: true, force: true });
  mkdirSync(MEDIA, { recursive: true });
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", { env: { ...process.env, DATABASE_URL: DB }, stdio: "pipe" });
  prisma = createPrisma(DB);
  await seedDatabase(prisma, catalogue);
  await createAdminUser(prisma, { email: "owner-g@test.beingyou", name: "Store Owner", password: "Neem-Tulsi-Cedar-41", role: "owner" });
  const logger = createLogger("silent");
  app = createApp({ config, prisma, logger, services: createServices({ config, prisma, logger, gateway: null }) });
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await prisma.$disconnect();
  rmSync(MEDIA, { recursive: true, force: true });
});

describe("sign-in with Google (store side, real database)", () => {
  it("reports itself as configured and sends the browser to Google with PKCE and the exact redirect URI", async () => {
    expect((await request(app).get("/api/auth/google/status")).body).toEqual({ configured: true });
    const start = await request(app).get("/api/auth/google/start");
    const to = new URL(start.headers["location"] as string);
    expect(to.origin).toBe("https://accounts.google.com");
    expect(to.searchParams.get("redirect_uri")).toBe(REDIRECT);
    expect(to.searchParams.get("code_challenge_method")).toBe("S256");
    expect(String(start.headers["location"])).not.toContain(CLIENT_SECRET);
    const flow = setCookies(start).find((c) => c.startsWith("bya_google_flow="))!;
    expect(flow).toMatch(/HttpOnly/i);
    expect(flow).toMatch(/SameSite=Lax/i);
  });

  it("creates a confirmed shopper on first sign-in and opens a real session", async () => {
    const res = await googleSignIn({ sub: "g-100", email: "Meera@Example.com", name: "Meera Iyer" });
    expect(res.status).toBe(302);
    expect(landing(res).toString()).toBe(`${SITE}/login?google=connected`);
    const cookie = session(res);
    expect(cookie).toBeTruthy();
    const me = await request(app).get("/api/customer/me").set("Cookie", cookie!);
    expect(me.status).toBe(200);
    expect(me.body.customer).toMatchObject({ email: "meera@example.com", name: "Meera Iyer", emailVerified: true, googleLinked: true, signInMethod: "google" });
    const row = await prisma.customer.findUniqueOrThrow({ where: { email: "meera@example.com" } });
    expect(row.googleSub).toBe("g-100");
    expect(row.passwordHash).toBeNull();
    // the PKCE verifier and secret went to Google's token endpoint, server to server
    const last = tokenRequests.at(-1)!;
    expect(last.get("code_verifier")).toBeTruthy();
    expect(last.get("client_secret")).toBe(CLIENT_SECRET);
  });

  it("signs a returning shopper into the same account without creating another", async () => {
    const before = await prisma.customer.count();
    const res = await googleSignIn({ sub: "g-100", email: "meera@example.com" });
    expect(landing(res).searchParams.get("google")).toBe("connected");
    expect(await prisma.customer.count()).toBe(before);
    const me = await request(app).get("/api/customer/me").set("Cookie", session(res)!);
    expect(me.body.customer.email).toBe("meera@example.com");
  });

  it("signs out: the session stops working", async () => {
    const res = await googleSignIn({ sub: "g-100", email: "meera@example.com" });
    const cookie = session(res)!;
    const out = await request(app).post("/api/customer/logout").set("Origin", SITE).set("Content-Type", "application/json").set("Cookie", cookie).send({});
    expect(out.status).toBe(200);
    expect((await request(app).get("/api/customer/me").set("Cookie", cookie)).status).toBe(401);
  });

  it("gives a Google shopper no admin access", async () => {
    const res = await googleSignIn({ sub: "g-100", email: "meera@example.com" });
    const cookie = session(res)!;
    for (const url of ["/api/admin/products", "/api/admin/orders", "/api/auth/me"]) {
      expect((await request(app).get(url).set("Cookie", cookie)).status).toBe(401);
    }
  });

  it("refuses a callback whose state doesn't match, with no flow cookie, or with a forged one", async () => {
    const before = await prisma.customer.count();
    const wrongState = await googleSignIn({ sub: "g-200", email: "x1@example.com" }, { state: "attacker-state" });
    expect(landing(wrongState).searchParams.get("reason")).toBe("expired");
    expect(session(wrongState)).toBeNull();
    const noCookie = await googleSignIn({ sub: "g-200", email: "x1@example.com" }, { cookie: null });
    expect(landing(noCookie).searchParams.get("reason")).toBe("expired");
    const forged = Buffer.from(JSON.stringify({ state: "s", nonce: "n", verifier: "v", issuedAt: Date.now() })).toString("base64url");
    const planted = await request(app).get("/api/auth/google/callback?code=c&state=s").set("Cookie", `bya_google_flow=${forged}.bad`);
    expect(landing(planted).searchParams.get("reason")).toBe("expired");
    expect(await prisma.customer.count()).toBe(before);
  });

  it("refuses a code Google won't redeem and an address Google hasn't confirmed", async () => {
    const start = await request(app).get("/api/auth/google/start");
    const state = new URL(start.headers["location"] as string).searchParams.get("state")!;
    const bogus = await request(app).get(`/api/auth/google/callback?code=never-issued&state=${state}`).set("Cookie", cookieNamed(start, "bya_google_flow")!);
    expect(landing(bogus).searchParams.get("google")).toBe("failed");
    expect(session(bogus)).toBeNull();
    const unconfirmed = await googleSignIn({ sub: "g-300", email: "unconfirmed@example.com", verified: false });
    expect(landing(unconfirmed).searchParams.get("google")).toBe("failed");
    expect(await prisma.customer.findUnique({ where: { email: "unconfirmed@example.com" } })).toBeNull();
  });

  it("never lets a Google address take over a password account whose email was never confirmed", async () => {
    const reg = await request(app).post("/api/customer/register").set("Origin", SITE).set("Content-Type", "application/json")
      .send({ name: "Victim", email: "victim@example.com", password: "Sandal-Wood-Morning-27" });
    expect(reg.status).toBe(200);
    const res = await googleSignIn({ sub: "g-attacker", email: "victim@example.com" });
    expect(landing(res).searchParams.get("reason")).toBe("password_account");
    expect(session(res)).toBeNull();
    const row = await prisma.customer.findUniqueOrThrow({ where: { email: "victim@example.com" } });
    expect(row.googleSub).toBeNull();
  });

  it("links Google to a password account once its email is confirmed, keeping the password", async () => {
    const reg = await request(app).post("/api/customer/register").set("Origin", SITE).set("Content-Type", "application/json")
      .send({ name: "Ravi", email: "ravi@example.com", password: "Vetiver-Clay-Sunrise-62" });
    expect(reg.status).toBe(200);
    const outbox = path.join(MEDIA, "outbox");
    const mail = readdirSync(outbox).map((f) => readFileSync(path.join(outbox, f), "utf8")).find((t) => t.includes("To: ravi@example.com") && t.includes("verify-email?token="))!;
    const token = mail.match(/verify-email\?token=([A-Za-z0-9_-]+)/)![1];
    expect((await request(app).post("/api/customer/verify-email").set("Origin", SITE).set("Content-Type", "application/json").send({ token })).status).toBe(200);
    const res = await googleSignIn({ sub: "g-ravi", email: "ravi@example.com" });
    expect(landing(res).searchParams.get("google")).toBe("connected");
    const row = await prisma.customer.findUniqueOrThrow({ where: { email: "ravi@example.com" } });
    expect(row.googleSub).toBe("g-ravi");
    expect(row.passwordHash).not.toBeNull();
    const pw = await request(app).post("/api/customer/login").set("Origin", SITE).set("Content-Type", "application/json").send({ email: "ravi@example.com", password: "Vetiver-Clay-Sunrise-62" });
    expect(pw.status).toBe(200);
  });

  it("won't re-point an account at a second Google identity with the same email", async () => {
    const res = await googleSignIn({ sub: "g-someone-else", email: "ravi@example.com" });
    expect(landing(res).searchParams.get("reason")).toBe("linked_elsewhere");
    expect((await prisma.customer.findUniqueOrThrow({ where: { email: "ravi@example.com" } })).googleSub).toBe("g-ravi");
  });

  it("keeps blocked shoppers out", async () => {
    await prisma.customer.update({ where: { email: "meera@example.com" }, data: { status: "BLOCKED" } });
    const res = await googleSignIn({ sub: "g-100", email: "meera@example.com" });
    expect(landing(res).searchParams.get("reason")).toBe("blocked");
    expect(session(res)).toBeNull();
    await prisma.customer.update({ where: { email: "meera@example.com" }, data: { status: "ACTIVE" } });
  });

  it("always returns the browser to the storefront's own sign-in page (no open redirect)", async () => {
    const res = await googleSignIn({ sub: "g-100", email: "meera@example.com" }, { query: "&redirect=https://evil.example&next=//evil.example&redirect_uri=https://evil.example" });
    expect(landing(res).origin).toBe(SITE);
    expect(landing(res).pathname).toBe("/login");
    const cancelled = await request(app).get("/api/auth/google/callback?error=access_denied&state=x&redirect=https://evil.example");
    expect(landing(cancelled).origin).toBe(SITE);
    expect(landing(cancelled).searchParams.get("reason")).toBe("cancelled");
  });

  it("can't reuse a flow cookie after it has been spent", async () => {
    const start = await request(app).get("/api/auth/google/start");
    const to = new URL(start.headers["location"] as string);
    const flow = cookieNamed(start, "bya_google_flow")!;
    const code = "code-once";
    issued.set(code, { nonce: to.searchParams.get("nonce")!, challenge: to.searchParams.get("code_challenge")!, who: { sub: "g-100", email: "meera@example.com" } });
    const first = await request(app).get(`/api/auth/google/callback?code=${code}&state=${to.searchParams.get("state")}`).set("Cookie", flow);
    expect(landing(first).searchParams.get("google")).toBe("connected");
    expect(setCookies(first).some((c) => c.startsWith("bya_google_flow=;"))).toBe(true);
    const replay = await request(app).get(`/api/auth/google/callback?code=${code}&state=${to.searchParams.get("state")}`).set("Cookie", flow);
    expect(landing(replay).searchParams.get("google")).toBe("failed");
    expect(session(replay)).toBeNull();
  });
});
