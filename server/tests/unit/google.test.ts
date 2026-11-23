// Google sign-in, production settings and media-folder rules (no database, no network: Google's
// signing keys are replaced with a key generated here, so every check runs on real RS256 signatures).
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeAll, describe, expect, it, vi } from "vitest";

import { loadConfig } from "../../src/config.js";
import { createLogger } from "../../src/logger.js";
import { createGoogleAuth } from "../../src/services/googleAuth.js";
import { checkMediaFolder } from "../../src/startupChecks.js";

const base = { DATABASE_URL: "mysql://u:p@h:3306/d" };
const CLIENT_ID = "1234567890-abcdefghij.apps.googleusercontent.com";
const GOOGLE = { AUTH_GOOGLE_ID: CLIENT_ID, AUTH_GOOGLE_SECRET: "google-client-secret-value", GOOGLE_REDIRECT_URL: "https://api.beingyoualways.com/api/auth/google/callback" };
const PROD = {
  ...base, NODE_ENV: "production", ORDER_LINK_SECRET: "o".repeat(40), CORS_ORIGINS: "https://beingyoualways.com,https://www.beingyoualways.com",
  PUBLIC_SITE_URL: "https://beingyoualways.com", MEDIA_ROOT: "/home/u1/bya-media",
};
const APP_DIR = "/home/u1/domains/api.beingyoualways.com/public_html";

describe("Google settings", () => {
  it("reads AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET", () => {
    const c = loadConfig({ ...base, ...GOOGLE });
    expect(c.google).toEqual({ clientId: CLIENT_ID, clientSecret: "google-client-secret-value", redirectUrl: GOOGLE.GOOGLE_REDIRECT_URL });
  });
  it("still accepts the older GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET names", () => {
    const c = loadConfig({ ...base, GOOGLE_CLIENT_ID: CLIENT_ID, GOOGLE_CLIENT_SECRET: "s", GOOGLE_REDIRECT_URL: GOOGLE.GOOGLE_REDIRECT_URL });
    expect(c.google?.clientId).toBe(CLIENT_ID);
  });
  it("refuses two different values for the same setting", () => {
    expect(() => loadConfig({ ...base, ...GOOGLE, GOOGLE_CLIENT_ID: "999-other.apps.googleusercontent.com" })).toThrow(/AUTH_GOOGLE_ID and GOOGLE_CLIENT_ID/);
  });
  it("stays off when nothing is set and refuses a half-set configuration", () => {
    expect(loadConfig(base).google).toBeNull();
    expect(() => loadConfig({ ...base, AUTH_GOOGLE_ID: CLIENT_ID })).toThrow(/must all be set/);
  });
  it("spots a client ID and secret pasted the wrong way round", () => {
    expect(() => loadConfig({ ...base, ...GOOGLE, AUTH_GOOGLE_ID: "GOCSPX-looks-like-a-secret" })).toThrow(/AUTH_GOOGLE_ID should look like/);
  });
  it("only allows the callback route the API actually serves", () => {
    expect(() => loadConfig({ ...base, ...GOOGLE, GOOGLE_REDIRECT_URL: "https://api.beingyoualways.com/auth/google/callback" })).toThrow(/\/api\/auth\/google\/callback/);
    expect(() => loadConfig({ ...base, ...GOOGLE, GOOGLE_REDIRECT_URL: "https://api.beingyoualways.com/api/auth/google/callback?next=x" })).toThrow(/exactly/);
  });
  it("needs https and AUTH_SECRET (32+ characters) in production", () => {
    expect(() => loadConfig({ ...PROD, ...GOOGLE }, APP_DIR)).toThrow(/AUTH_SECRET is required/);
    expect(() => loadConfig({ ...PROD, ...GOOGLE, AUTH_SECRET: "short" }, APP_DIR)).toThrow(/at least 32/);
    expect(() => loadConfig({ ...PROD, ...GOOGLE, AUTH_SECRET: "k".repeat(40), GOOGLE_REDIRECT_URL: "http://api.beingyoualways.com/api/auth/google/callback" }, APP_DIR)).toThrow(/https/);
    expect(loadConfig({ ...PROD, ...GOOGLE, AUTH_SECRET: "k".repeat(40) }, APP_DIR).authSecret).toBe("k".repeat(40));
  });
});

describe("production settings", () => {
  it("requires the storefront address to be https and one of the allowed origins", () => {
    expect(() => loadConfig({ ...PROD, PUBLIC_SITE_URL: "http://beingyoualways.com" }, APP_DIR)).toThrow(/PUBLIC_SITE_URL must use https/);
    expect(() => loadConfig({ ...PROD, PUBLIC_SITE_URL: "https://elsewhere.example" }, APP_DIR)).toThrow(/CORS_ORIGINS/);
  });
  it("keeps uploads outside the deploy folder so a GitHub redeploy can't delete them", () => {
    expect(() => loadConfig({ ...PROD, MEDIA_ROOT: "./media" }, APP_DIR)).toThrow(/MEDIA_ROOT must be an absolute folder outside/);
    expect(() => loadConfig({ ...PROD, MEDIA_ROOT: `${APP_DIR}/media` }, APP_DIR)).toThrow(/MEDIA_ROOT/);
    expect(() => loadConfig({ ...PROD, MEDIA_ROOT: APP_DIR }, APP_DIR)).toThrow(/MEDIA_ROOT/);
    expect(loadConfig(PROD, APP_DIR).media.root).toBe("/home/u1/bya-media");
  });
  it("uses an absolute media path as given (not nested inside the app folder)", () => {
    expect(loadConfig({ ...base, MEDIA_ROOT: "/tmp/bya-media" }, "/srv/app").media.root).toBe("/tmp/bya-media");
    expect(loadConfig({ ...base, MEDIA_ROOT: "./media" }, "/srv/app").media.root).toBe("/srv/app/media");
  });
  it("checks at start that the media folder can be written to", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bya-media-"));
    expect(await checkMediaFolder(join(dir, "nested"))).toEqual({ ok: true });
    const blocked = await checkMediaFolder("/proc/bya-not-writable");
    expect(blocked.ok).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("Google sign-in verification", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-key", alg: "RS256", use: "sig" };
  const config = loadConfig({ ...base, ...GOOGLE, AUTH_SECRET: "s".repeat(40) });
  const google = createGoogleAuth(config, createLogger("silent"));
  const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const token = (claims: Record<string, unknown>, key = privateKey, kid = "test-key") => {
    const head = b64({ alg: "RS256", kid, typ: "JWT" });
    const body = b64(claims);
    return `${head}.${body}.${sign("RSA-SHA256", Buffer.from(`${head}.${body}`), key).toString("base64url")}`;
  };
  const good = () => ({
    iss: "https://accounts.google.com", aud: CLIENT_ID, exp: Math.floor(Date.now() / 1000) + 600, nonce: "n-1",
    sub: "1100220033", email: "Asha@Example.com", email_verified: true, name: "Asha",
  });

  beforeAll(() => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).includes("/oauth2/v3/certs")) return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
      throw new Error(`unexpected request to ${url}`);
    }));
  });
  it("accepts a correctly signed token for this store and lower-cases the email", async () => {
    const id = await google.verifyIdToken(token(good()), "n-1");
    expect(id).toEqual({ sub: "1100220033", email: "asha@example.com", emailVerified: true, name: "Asha" });
  });
  it("refuses tokens for another app, from another issuer, expired, replayed or with an unconfirmed email", async () => {
    await expect(google.verifyIdToken(token({ ...good(), aud: "other.apps.googleusercontent.com" }), "n-1")).rejects.toThrow(/wasn't meant for this store/);
    await expect(google.verifyIdToken(token({ ...good(), iss: "https://evil.example" }), "n-1")).rejects.toThrow(/didn't come from Google/);
    await expect(google.verifyIdToken(token({ ...good(), exp: Math.floor(Date.now() / 1000) - 5 }), "n-1")).rejects.toThrow(/expired/);
    await expect(google.verifyIdToken(token(good()), "different-nonce")).rejects.toThrow(/already been used/);
    await expect(google.verifyIdToken(token({ ...good(), email_verified: false }), "n-1")).rejects.toThrow(/hasn't confirmed/);
  });
  it("refuses a token signed with any other key", async () => {
    const other = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
    await expect(google.verifyIdToken(token(good(), other), "n-1")).rejects.toThrow(/verification/);
    await expect(google.verifyIdToken(token(good(), privateKey, "unknown-kid"), "n-1")).rejects.toThrow(/couldn't be verified/);
  });

  it("starts with PKCE, a fresh state and nonce, and the exact redirect URI", () => {
    const a = google.start();
    const b = google.start();
    const url = new URL(a.url);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("redirect_uri")).toBe(GOOGLE.GOOGLE_REDIRECT_URL);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(url.toString()).not.toContain(GOOGLE.AUTH_GOOGLE_SECRET);
    expect(a.state).not.toBe(b.state);
    expect(a.nonce).not.toBe(b.nonce);
  });

  it("only trusts the flow cookie it signed itself, and only for 10 minutes", () => {
    const flow = { state: "s1", nonce: "n1", verifier: "v1", issuedAt: Date.now() };
    const sealed = google.seal(flow);
    expect(google.open(sealed)).toEqual(flow);
    const [body] = sealed.split(".");
    const edited = Buffer.from(JSON.stringify({ ...flow, state: "attacker" })).toString("base64url");
    expect(google.open(`${edited}.${sealed.split(".")[1]}`)).toBeNull();
    expect(google.open(`${body}.forged`)).toBeNull();
    expect(google.open(JSON.stringify(flow))).toBeNull();
    expect(google.open(sealed, Date.now() + 11 * 60_000)).toBeNull();
    const otherStore = createGoogleAuth(loadConfig({ ...base, ...GOOGLE, AUTH_SECRET: "t".repeat(40) }), createLogger("silent"));
    expect(otherStore.open(sealed)).toBeNull();
  });
});
