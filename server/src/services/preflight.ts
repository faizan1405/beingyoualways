// `npm run deploy:check` — run on Hostinger (SSH, in the server folder) before and after each deploy.
// Checks configuration, database migrations, environment stamps, the media folder, the live HTTPS
// address (CORS, cookies, webhook signature checks) and — with --providers — makes read-only calls to
// Razorpay, Google, Meta and the mail server. It never prints a secret, a phone number or an email.
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import type { PrismaClient } from "@prisma/client";

import { ConfigError, GOOGLE_CALLBACK_PATH, loadConfig, type Config } from "../config.js";
import { checkMediaFolder } from "../startupChecks.js";
import { readDatabaseMarker, readMediaMarker } from "./environmentMarker.js";

export type CheckStatus = "pass" | "warn" | "fail" | "skip";
export interface Check { group: string; name: string; status: CheckStatus; detail: string }

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface PreflightOptions {
  env: NodeJS.ProcessEnv;
  cwd: string;
  /** public https address of this API, e.g. https://api-staging.beingyoualways.com */
  apiUrl?: string | undefined;
  providers: boolean;
  fetch?: Fetch;
  prisma?: (url: string) => PrismaClient;
  smtpVerify?: (mail: NonNullable<Config["mail"]>) => Promise<void>;
}

const TIMEOUT = 10_000;

/** Google's answer to a deliberately invalid code tells whether the client ID + secret pair is real. */
export function interpretGoogleTokenProbe(status: number, body: { error?: string; error_description?: string }): Omit<Check, "group" | "name"> {
  if (body.error === "invalid_grant") return { status: "pass", detail: "Google accepted the client ID and secret (the test code was rejected, as expected)" };
  if (body.error === "invalid_client" || body.error === "unauthorized_client") return { status: "fail", detail: "Google rejected AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET — copy them again from the OAuth client" };
  if (body.error === "redirect_uri_mismatch") return { status: "fail", detail: "GOOGLE_REDIRECT_URL isn't an authorised redirect URI on the OAuth client" };
  return { status: "warn", detail: `unexpected Google answer (${status}${body.error ? ` ${body.error}` : ""})` };
}

/** Is our Meta app subscribed to the WhatsApp business account (needed to receive webhooks)? */
export function interpretSubscribedApps(appId: string, body: { data?: { whatsapp_business_api_data?: { id?: string } }[] }): Omit<Check, "group" | "name"> {
  const ids = (body.data ?? []).map((d) => d.whatsapp_business_api_data?.id).filter(Boolean);
  return ids.includes(appId)
    ? { status: "pass", detail: "the app is subscribed to the WhatsApp business account" }
    : { status: "fail", detail: "the app isn't subscribed to the business account yet — run the subscribed_apps call in the staging guide" };
}

export async function runPreflight(opts: PreflightOptions): Promise<Check[]> {
  const out: Check[] = [];
  const add = (group: string, name: string, status: CheckStatus, detail: string) => { out.push({ group, name, status, detail }); };
  const http: Fetch = opts.fetch ?? ((url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT) }));

  let config: Config;
  try {
    config = loadConfig(opts.env, opts.cwd);
    add("config", "environment variables", "pass", `valid — NODE_ENV=${config.env}, STORE_ENVIRONMENT=${config.deployment}`);
  } catch (e) {
    add("config", "environment variables", "fail", e instanceof ConfigError ? e.message : "could not read the configuration");
    return out;
  }
  const staging = config.deployment === "staging";
  const prod = config.deployment === "production";

  /* ── configuration summary ── */
  if (config.deployment === "development") add("config", "store environment", config.env === "production" ? "fail" : "warn", "development — not a Hostinger setting (set STORE_ENVIRONMENT)");
  add("config", "test orders", staging ? "pass" : config.storeTestMode ? "warn" : "pass", config.storeTestMode ? "every order is marked Test and left out of sales" : "orders count as real sales");
  if (!config.razorpay) add("config", "Razorpay", "warn", "off — online payment is switched off (COD only, if enabled)");
  else add("config", "Razorpay", prod && config.razorpay.mode === "test" ? "warn" : "pass", `${config.razorpay.mode} keys${prod && config.razorpay.mode === "test" ? " — swap to live keys only after the owner approves launch" : ""}`);
  add("config", "cookies", config.cookie.secure || config.env !== "production" ? "pass" : "fail",
    `admin "${config.cookie.name}", shopper "${config.customer.cookie}", ${config.cookie.secure ? "Secure" : "NOT Secure"}, SameSite=${config.cookie.sameSite}, ${config.cookie.domain ? `domain ${config.cookie.domain}` : "host-only"}`);
  add("config", "website addresses", "pass", `PUBLIC_SITE_URL ${config.publicSiteUrl}; CORS_ORIGINS ${config.corsOrigins.join(", ") || "(none)"}`);
  add("config", "Google sign-in", config.google ? "pass" : "warn", config.google ? `on — callback ${config.google.redirectUrl}` : "off — the site says Google sign-in isn't set up");
  add("config", "email", config.mail ? "pass" : "warn", config.mail
    ? `SMTP ${config.mail.host}:${config.mail.port}${staging ? ` — staging sends only to ${config.mailAllowList.length} allowed address/domain entr${config.mailAllowList.length === 1 ? "y" : "ies"}` : ""}`
    : "outbox — messages are written to MEDIA_ROOT/outbox, not sent");
  add("config", "WhatsApp", config.whatsapp ? "pass" : "warn", config.whatsapp
    ? `on — Graph ${config.whatsapp.graphVersion}${staging ? `, staging sends only to ${config.whatsapp.testRecipients.length} test number(s)` : ""}`
    : "off — nothing is sent");
  add("config", "background jobs", config.whatsappWorker ? "pass" : "warn", config.whatsappWorker ? "WhatsApp sender, 6-hour reminders and campaigns run in this process; payment sweep every 5 minutes" : "WHATSAPP_WORKER=false — no messages or reminders are sent from this instance");

  /* ── media folder ── */
  const media = await checkMediaFolder(config.media.root);
  add("media", "folder writable", media.ok ? "pass" : "fail", media.ok ? config.media.root : media.message);
  if (media.ok) {
    const m = await readMediaMarker(config.media.root).catch(() => "unknown" as const);
    if (config.deployment === "development") add("media", "environment stamp", "skip", "not used in development");
    else if (m === null) add("media", "environment stamp", "warn", `not stamped yet — the first start stamps it "${config.deployment}"`);
    else add("media", "environment stamp", m === config.deployment ? "pass" : "fail", m === config.deployment ? `stamped ${m}` : `stamped ${m} — this folder belongs to another store`);
  }

  /* ── database ── */
  const prisma = opts.prisma ? opts.prisma(config.databaseUrl) : new (await import("@prisma/client")).PrismaClient({ datasources: { db: { url: config.databaseUrl } }, log: [] });
  try {
    await prisma.$queryRaw`SELECT 1`;
    add("database", "connection", "pass", "MySQL answers");
    let folder: string[] = [];
    try { folder = (await readdir(join(opts.cwd, "prisma", "migrations"), { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort(); } catch { /* reported below */ }
    let applied: string[] = [];
    let failed = 0;
    try {
      const rows = await prisma.$queryRaw<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]>`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations`;
      applied = rows.filter((r) => r.finished_at && !r.rolled_back_at).map((r) => r.migration_name);
      failed = rows.filter((r) => !r.finished_at && !r.rolled_back_at).length;
    } catch { /* empty database */ }
    const pending = folder.filter((f) => !applied.includes(f));
    const unknown = applied.filter((a) => !folder.includes(a));
    if (folder.length === 0) add("database", "migrations", "fail", "prisma/migrations not found — run this from the server folder");
    else if (failed) add("database", "migrations", "fail", `${failed} migration(s) failed half-way — restore the backup taken before the deploy (see rollback)`);
    else if (pending.length) add("database", "migrations", "fail", `${pending.length} pending: ${pending.join(", ")} — back up, then npm run db:migrate`);
    else add("database", "migrations", unknown.length ? "warn" : "pass", unknown.length ? `all applied; the database also has ${unknown.length} newer migration(s) this code doesn't know (older code deployed?)` : `all ${folder.length} applied`);

    if (applied.length) {
      const marker = await readDatabaseMarker(prisma);
      if (config.deployment === "development") add("database", "environment stamp", "skip", "not used in development");
      else if (marker === null) add("database", "environment stamp", "warn", `not stamped yet — the first start stamps it "${config.deployment}"`);
      else add("database", "environment stamp", marker === config.deployment ? "pass" : "fail", marker === config.deployment ? `stamped ${marker}` : `stamped ${String(marker)} — this database belongs to another store`);
      const [admins, active, realOrders] = await Promise.all([
        prisma.user.count({ where: { isActive: true } }),
        prisma.product.count({ where: { status: "ACTIVE" } }),
        prisma.order.count({ where: { isTest: false } }),
      ]);
      add("database", "admin accounts", admins ? "pass" : "warn", admins ? `${admins} active` : "none yet — run npm run admin:create");
      add("database", "catalogue", active ? "pass" : "warn", active ? `${active} visible products` : "no visible products — run npm run db:seed:prod");
      if (staging) add("database", "real orders", realOrders ? "fail" : "pass", realOrders ? `${realOrders} non-test order(s) — this looks like a copy of the live database; staging must start from its own empty database` : "none — test data only");
    }
  } catch (e) {
    add("database", "connection", "fail", `can't reach MySQL (${e instanceof Error ? e.message.split("\n").find((l) => l.trim()) ?? "error" : "error"})`.slice(0, 300));
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }

  /* ── the live address (only when --api-url is given) ── */
  const api = opts.apiUrl?.replace(/\/+$/, "");
  if (!api) add("live", "public address", "skip", "pass --api-url https://<api-domain> to test HTTPS, CORS and webhooks from the outside");
  else {
    const origin = new URL(config.publicSiteUrl).origin;
    if (config.env === "production" && !api.startsWith("https://")) add("live", "https", "fail", "the API address must be https");
    if (config.google && new URL(config.google.redirectUrl).origin !== new URL(api).origin) add("live", "Google callback address", "fail", `GOOGLE_REDIRECT_URL should be ${api}${GOOGLE_CALLBACK_PATH}`);
    try {
      const r = await http(`${api}/api/health`, { headers: { Origin: origin } });
      const body = await r.json().catch(() => ({})) as { database?: string; environment?: string };
      add("live", "health", r.ok && body.database === "ok" ? "pass" : "fail", `${r.status}, database ${body.database ?? "?"}`);
      add("live", "same server", body.environment === config.deployment ? "pass" : "fail", body.environment === config.deployment ? `answers as ${body.environment}` : `the address answers as "${body.environment ?? "unknown"}" — it isn't this server`);
      const allow = r.headers.get("access-control-allow-origin"), cred = r.headers.get("access-control-allow-credentials");
      add("live", "CORS for the website", allow === origin && cred === "true" ? "pass" : "fail", allow === origin && cred === "true" ? `${origin} may call the API with cookies` : `the API doesn't allow ${origin} with cookies — check CORS_ORIGINS`);
      if (api.startsWith("https://")) add("live", "HSTS", r.headers.get("strict-transport-security") ? "pass" : "warn", r.headers.get("strict-transport-security") ? "browsers are told to use https only" : "no Strict-Transport-Security header");
      add("live", "not indexed", (r.headers.get("x-robots-tag") ?? "").includes("noindex") ? "pass" : "fail", "X-Robots-Tag noindex on API responses");
    } catch (e) {
      add("live", "health", "fail", `couldn't reach ${api} (${e instanceof Error ? e.message : "error"})`);
    }
    const probe = async (name: string, url: string, init: RequestInit, expect: (s: number) => boolean, ok: string) => {
      try {
        const r = await http(url, init);
        add("live", name, r.status === 404 ? "fail" : expect(r.status) ? "pass" : "fail", r.status === 404 ? "route not found — wrong API address?" : expect(r.status) ? ok : `unexpected ${r.status} for an unsigned request`);
      } catch (e) { add("live", name, "fail", `couldn't reach it (${e instanceof Error ? e.message : "error"})`); }
    };
    await probe("Razorpay webhook", `${api}/api/webhooks/razorpay`, { method: "POST", headers: { "Content-Type": "application/json", "X-Razorpay-Signature": "preflight-invalid" }, body: "{}" },
      (s) => s >= 400 && s < 500 || (!config.razorpay && s === 503), config.razorpay ? "reachable; an unsigned delivery is refused" : "reachable; refused because Razorpay is off");
    await probe("WhatsApp webhook", `${api}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=preflight-invalid&hub.challenge=123`, {},
      (s) => s === 403, "reachable; a wrong verify token is refused");
    await probe("WhatsApp webhook signature", `${api}/api/whatsapp/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": "sha256=00" }, body: "{}" },
      (s) => s === 401 || (!config.whatsapp && s === 503), config.whatsapp ? "an unsigned delivery is refused" : "refused because WhatsApp is off");
    // the website itself: staging must ask for the password, production must be public
    try {
      const r = await http(config.publicSiteUrl, { redirect: "manual" });
      if (staging) add("live", "website locked", r.status === 401 ? "pass" : "fail", r.status === 401 ? "asks for the staging password" : `answered ${r.status} without a password — set VITE_SITE_ENV=staging and STAGING_ACCESS_PASSWORD on the website app`);
      else add("live", "website", r.status < 400 ? "pass" : "warn", `${config.publicSiteUrl} answered ${r.status}`);
    } catch (e) { add("live", staging ? "website locked" : "website", "warn", `couldn't reach ${config.publicSiteUrl} (${e instanceof Error ? e.message : "error"})`); }
  }

  /* ── providers (read-only calls, only with --providers) ── */
  if (!opts.providers) add("providers", "real provider checks", "skip", "pass --providers to make read-only calls to Razorpay, Google, Meta and the mail server");
  else {
    if (config.razorpay) {
      try {
        const r = await http("https://api.razorpay.com/v1/orders?count=1", { headers: { Authorization: `Basic ${Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString("base64")}` } });
        add("providers", "Razorpay keys", r.ok ? "pass" : "fail", r.ok ? `Razorpay accepted the ${config.razorpay.mode} keys` : r.status === 401 ? "Razorpay rejected RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET" : `Razorpay answered ${r.status}`);
      } catch (e) { add("providers", "Razorpay keys", "fail", `couldn't reach Razorpay (${e instanceof Error ? e.message : "error"})`); }
      add("providers", "Razorpay webhook secret", "skip", "only Razorpay can prove it: send a test webhook from the dashboard and look for it in Admin → Orders → payment events");
    } else add("providers", "Razorpay", "skip", "off");
    if (config.google) {
      try {
        const r = await http("https://oauth2.googleapis.com/token", {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ grant_type: "authorization_code", code: "preflight-invalid-code", client_id: config.google.clientId, client_secret: config.google.clientSecret, redirect_uri: config.google.redirectUrl }).toString(),
        });
        const v = interpretGoogleTokenProbe(r.status, (await r.json().catch(() => ({}))) as { error?: string });
        add("providers", "Google OAuth client", v.status, v.detail);
      } catch (e) { add("providers", "Google OAuth client", "fail", `couldn't reach Google (${e instanceof Error ? e.message : "error"})`); }
    } else add("providers", "Google", "skip", "off");
    if (config.whatsapp) {
      const wa = config.whatsapp;
      const g = (path: string) => http(`https://graph.facebook.com/${wa.graphVersion}/${path}`, { headers: { Authorization: `Bearer ${wa.accessToken}` } });
      try {
        const r = await g(`${wa.phoneNumberId}?fields=verified_name,quality_rating,code_verification_status`);
        const b = await r.json().catch(() => ({})) as { verified_name?: string; quality_rating?: string; error?: { message?: string } };
        add("providers", "Meta phone number", r.ok ? "pass" : "fail", r.ok ? `"${b.verified_name ?? "?"}", quality ${b.quality_rating ?? "?"}` : `Meta refused (${(b.error?.message ?? String(r.status)).slice(0, 160)})`);
        const s = await g(`${wa.wabaId}/subscribed_apps`);
        if (s.ok) {
          const v = interpretSubscribedApps(wa.appId, (await s.json().catch(() => ({}))) as { data?: { whatsapp_business_api_data?: { id?: string } }[] });
          add("providers", "Meta webhook subscription", v.status, v.detail);
        }
        else add("providers", "Meta webhook subscription", "fail", `Meta answered ${s.status}`);
      } catch (e) { add("providers", "Meta", "fail", `couldn't reach Meta (${e instanceof Error ? e.message : "error"})`); }
    } else add("providers", "WhatsApp", "skip", "off");
    if (config.mail) {
      try {
        if (opts.smtpVerify) await opts.smtpVerify(config.mail);
        else {
          const nodemailer = (await import("nodemailer")).default;
          await nodemailer.createTransport({ host: config.mail.host, port: config.mail.port, secure: config.mail.port === 465, auth: { user: config.mail.user, pass: config.mail.password } }).verify();
        }
        add("providers", "SMTP sign-in", "pass", "the mail server accepted the mailbox login (no email was sent)");
      } catch (e) { add("providers", "SMTP sign-in", "fail", `the mail server refused (${(e instanceof Error ? e.message : "error").slice(0, 160)})`); }
    } else add("providers", "SMTP", "skip", "outbox mode");
  }
  return out;
}

export function formatChecks(checks: Check[]): string {
  const mark: Record<CheckStatus, string> = { pass: "OK  ", warn: "WARN", fail: "FAIL", skip: "--  " };
  let group = "";
  const lines: string[] = [];
  for (const c of checks) {
    if (c.group !== group) { group = c.group; lines.push("", `[${group}]`); }
    lines.push(`  ${mark[c.status]}  ${c.name}: ${c.detail}`);
  }
  const fails = checks.filter((c) => c.status === "fail").length, warns = checks.filter((c) => c.status === "warn").length;
  lines.push("", fails ? `${fails} problem(s) to fix, ${warns} warning(s).` : `No problems. ${warns} warning(s).`);
  return lines.join("\n");
}
