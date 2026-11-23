// PHASE 6 — REAL DATABASE TESTS for the staging copy: environment stamps on the database and media
// folder, WhatsApp only to listed test numbers, and deploy:check against a running API.
//   TEST_DATABASE_URL="mysql://…/bya_test" npm run test:db
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp, createServices } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import { createPrisma } from "../../src/db.js";
import { createLogger } from "../../src/logger.js";
import { MARKER_KEY, ensureDatabaseMarker, ensureMediaMarker } from "../../src/services/environmentMarker.js";
import { runPreflight } from "../../src/services/preflight.js";
import { WA_ENV, createFakeMeta } from "../support/fakeMeta.js";

const DB = process.env["TEST_DATABASE_URL"];
if (!DB) throw new Error("TEST_DATABASE_URL is required for the real-database tests.");
if (!/test/i.test(new URL(DB).pathname)) throw new Error("Refusing to reset a database whose name doesn't contain 'test'.");

const SITE = "https://staging.shop.example";
const SERVER_DIR = join(__dirname, "../..");
const media = mkdtempSync(join(tmpdir(), "bya-staging-media-"));
const ENV = {
  NODE_ENV: "test", STORE_ENVIRONMENT: "staging", DATABASE_URL: DB, CORS_ORIGINS: SITE, PUBLIC_SITE_URL: SITE,
  LOG_LEVEL: "silent", ORDER_LINK_SECRET: "a".repeat(40), MEDIA_ROOT: media, ...WA_ENV,
};
const config = loadConfig(ENV);
let prisma: PrismaClient;

beforeAll(async () => {
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", { env: { ...process.env, DATABASE_URL: DB }, stdio: "pipe" });
  prisma = createPrisma(DB);
});
afterAll(async () => { await prisma?.$disconnect(); });

describe("environment stamps", () => {
  it("stamps a fresh staging database once and then refuses the live store", async () => {
    expect(await ensureDatabaseMarker(prisma, "staging")).toMatchObject({ ok: true, created: true, stamped: "staging" });
    expect(await ensureDatabaseMarker(prisma, "staging")).toMatchObject({ ok: true, created: false });
    const live = await ensureDatabaseMarker(prisma, "production");
    expect(live.ok).toBe(false);
    expect(!live.ok && live.message).toMatch(/belongs to the staging store/);
    // the reverse: a staging server pointed at the live database
    await prisma.storeSetting.update({ where: { key: MARKER_KEY }, data: { value: { environment: "production" } } });
    const r = await ensureDatabaseMarker(prisma, "staging");
    expect(!r.ok && r.message).toMatch(/belongs to the production store, but this server is staging/);
    await prisma.storeSetting.update({ where: { key: MARKER_KEY }, data: { value: { environment: "staging" } } });
  });
  it("does the same for the media folder", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bya-marker-"));
    expect(await ensureMediaMarker(dir, "production")).toMatchObject({ ok: true, created: true });
    const r = await ensureMediaMarker(dir, "staging");
    expect(!r.ok && r.message).toMatch(/media folder \(MEDIA_ROOT\) belongs to the production store/);
    writeFileSync(join(dir, ".bya-environment"), "garbage\n");
    expect((await ensureMediaMarker(dir, "production")).ok).toBe(false);
  });
});

describe("staging WhatsApp", () => {
  it("sends only to WHATSAPP_TEST_RECIPIENTS and records everyone else as not sent", async () => {
    const meta = createFakeMeta();
    const services = createServices({ config, prisma, logger: createLogger("silent"), gateway: null, graph: meta.graph });
    const tester = await services.wa.sendNow({ kind: "test", purpose: "test", phone: "919876500001" });
    expect(tester.ok).toBe(true);
    const customer = await services.wa.sendNow({ kind: "test", purpose: "test", phone: "919812345678" });
    expect(customer.ok).toBe(false);
    expect(!customer.ok && customer.reason).toMatch(/staging store/);
    expect(meta.sent.map((m) => m.to)).toEqual(["919876500001"]);
    const row = await prisma.whatsAppMessage.findFirstOrThrow({ where: { phone: "919812345678" } });
    expect(row.state).toBe("SKIPPED");
  });
});

describe("deploy:check", () => {
  it("passes a correct staging setup end to end over HTTP and names the problems in a wrong one", async () => {
    await ensureMediaMarker(media, "staging");
    const app = createApp({ config, prisma, logger: createLogger("silent"), gateway: null, services: createServices({ config, prisma, logger: createLogger("silent"), gateway: null, graph: createFakeMeta().graph }) });
    const server = app.listen(0);
    const api = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    // the staging website is reached through a stand-in that asks for the password, like the real one
    const fetcher = (url: string, init?: RequestInit) => (url.startsWith(SITE) ? Promise.resolve(new Response("locked", { status: 401 })) : fetch(url, init));
    try {
      const checks = await runPreflight({ env: ENV, cwd: SERVER_DIR, apiUrl: api, providers: false, fetch: fetcher });
      const failed = checks.filter((c) => c.status === "fail");
      expect(failed).toEqual([]);
      const by = (n: string) => checks.find((c) => c.name === n);
      expect(by("migrations")?.detail).toMatch(/all \d+ applied/);
      expect(by("environment stamp")?.status).toBe("pass");
      expect(by("same server")?.detail).toBe("answers as staging");
      expect(by("CORS for the website")?.status).toBe("pass");
      expect(by("WhatsApp webhook signature")?.status).toBe("pass");
      expect(by("website locked")?.status).toBe("pass");
      expect(JSON.stringify(checks)).not.toContain(WA_ENV.WHATSAPP_ACCESS_TOKEN);
      expect(JSON.stringify(checks)).not.toContain("a".repeat(40));

      // pointed at the live database by mistake
      await prisma.storeSetting.update({ where: { key: MARKER_KEY }, data: { value: { environment: "production" } } });
      const wrong = await runPreflight({ env: { ...ENV, CORS_ORIGINS: `${SITE},https://other.example` }, cwd: SERVER_DIR, apiUrl: api, providers: false, fetch: (u, i) => (u.startsWith(SITE) ? Promise.resolve(new Response("open", { status: 200 })) : fetch(u, i)) });
      const names = wrong.filter((c) => c.status === "fail").map((c) => c.name);
      expect(names).toContain("environment stamp");
      expect(names).toContain("website locked");
    } finally {
      await prisma.storeSetting.update({ where: { key: MARKER_KEY }, data: { value: { environment: "staging" } } });
      await new Promise((r) => server.close(r));
    }
  });
});
