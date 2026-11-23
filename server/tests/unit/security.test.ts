// Pure unit tests (no database).
import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/config.js";
import { createLogger, redact } from "../../src/logger.js";
import { passwordProblem } from "../../src/services/password.js";
import { hashToken, newToken } from "../../src/services/tokens.js";

const base = { DATABASE_URL: "mysql://u:p@h:3306/d" };

describe("configuration", () => {
  it("requires a mysql DATABASE_URL and names the variable without its value", () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
    try { loadConfig({ DATABASE_URL: "postgres://user:S3cret@x/y" }); } catch (e) { expect(String(e)).not.toContain("S3cret"); }
  });
  it("requires https CORS origins in production", () => {
    expect(() => loadConfig({ ...base, NODE_ENV: "production", STORE_ENVIRONMENT: "production", ORDER_LINK_SECRET: "x".repeat(32) })).toThrow(/CORS_ORIGINS/);
    expect(() => loadConfig({ ...base, NODE_ENV: "production", STORE_ENVIRONMENT: "production", ORDER_LINK_SECRET: "x".repeat(32), CORS_ORIGINS: "http://beingyoualways.com" })).toThrow(/https/);
    const c = loadConfig({ ...base, NODE_ENV: "production", STORE_ENVIRONMENT: "production", ORDER_LINK_SECRET: "x".repeat(32), CORS_ORIGINS: "https://beingyoualways.com/", PUBLIC_SITE_URL: "https://beingyoualways.com", MEDIA_ROOT: "/srv/bya-media" }, "/srv/app");
    expect(c.corsOrigins).toEqual(["https://beingyoualways.com"]);
    expect(c.cookie.secure).toBe(true);
  });
  it("uses 5 failed attempts and a 15-minute lock by default", () => {
    const c = loadConfig(base);
    expect(c.login.maxAttempts).toBe(5);
    expect(c.login.lockMs).toBe(15 * 60_000);
  });
});

describe("logging", () => {
  it("redacts passwords, tokens, cookies and connection-string credentials", () => {
    const out = redact({ password: "hunter2", nested: { sessionToken: "abc" }, url: "mysql://bya:S3cretPw@db:3306/x", note: "fine" }) as Record<string, unknown>;
    expect(JSON.stringify(out)).not.toMatch(/hunter2|abc|S3cretPw/);
    expect(out["note"]).toBe("fine");
  });
  it("writes one JSON line per event", () => {
    const lines: string[] = [];
    createLogger("info", (l) => lines.push(l)).info("hello", { password: "x" });
    expect(JSON.parse(lines[0]!)).toMatchObject({ level: "info", msg: "hello", password: "[redacted]" });
  });
});

describe("admin password policy", () => {
  it("rejects short or guessable passwords", () => {
    expect(passwordProblem("short")).toMatch(/12/);
    expect(passwordProblem("aaaaaaaaaaaaaa")).not.toBeNull();
    expect(passwordProblem("password1234")).not.toBeNull();
    expect(passwordProblem("priya-rose-garden-42", "priya@beingyoualways.com")).not.toBeNull();
    expect(passwordProblem("Monsoon-Tulsi-Ritual-27")).toBeNull();
  });
});

describe("session tokens", () => {
  it("are random 256-bit values stored only as SHA-256 hashes", () => {
    const a = newToken();
    expect(a).not.toBe(newToken());
    expect(Buffer.from(a, "base64url").length).toBe(32);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).not.toContain(a);
  });
});

describe("browser cross-site rules", () => {
  it("lets the website's own address send every kind of request the admin uses (incl. saving settings)", async () => {
    const express = (await import("express")).default;
    const request = (await import("supertest")).default;
    const { corsPolicy } = await import("../../src/middleware/security.js");
    const app = express();
    app.use(corsPolicy(loadConfig({ ...base, CORS_ORIGINS: "http://localhost:8090" })));
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const res = await request(app).options("/api/admin/settings/cod").set("Origin", "http://localhost:8090").set("Access-Control-Request-Method", method).set("Access-Control-Request-Headers", "content-type");
      expect(res.headers["access-control-allow-methods"]).toContain(method);
      expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:8090");
    }
    const other = await request(app).options("/api/admin/settings/cod").set("Origin", "https://evil.example").set("Access-Control-Request-Method", "PUT");
    expect(other.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
