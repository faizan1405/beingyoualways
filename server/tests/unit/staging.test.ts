// Phase 6: the staging copy must never touch real customers, payments or the live store's cookies.
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/config.js";
import { createLogger } from "../../src/logger.js";
import { createMailer, mailAllowed } from "../../src/services/mailer.js";
import { interpretGoogleTokenProbe, interpretSubscribedApps } from "../../src/services/preflight.js";
import { WA_ENV } from "../support/fakeMeta.js";

const APP_DIR = "/home/u1/domains/api-staging/public_html";
const STAGING = {
  DATABASE_URL: "mysql://u:p@h:3306/bya_staging", NODE_ENV: "production", STORE_ENVIRONMENT: "staging",
  ORDER_LINK_SECRET: "s".repeat(40), CORS_ORIGINS: "https://staging.beingyoualways.com",
  PUBLIC_SITE_URL: "https://staging.beingyoualways.com", MEDIA_ROOT: "/home/u1/bya-media-staging",
};
const SMTP = { MAIL_TRANSPORT: "smtp", SMTP_HOST: "smtp.hostinger.com", SMTP_USER: "no-reply@beingyoualways.com", SMTP_PASSWORD: "mailbox-password" };

describe("staging configuration", () => {
  it("requires STORE_ENVIRONMENT in production so a copy is never staging or live by accident", () => {
    const { STORE_ENVIRONMENT: _, ...rest } = STAGING;
    expect(() => loadConfig(rest, APP_DIR)).toThrow(/STORE_ENVIRONMENT is required/);
  });
  it("marks every staging order as a test order and refuses to switch that off", () => {
    expect(loadConfig(STAGING, APP_DIR).storeTestMode).toBe(true);
    expect(() => loadConfig({ ...STAGING, STORE_TEST_MODE: "false" }, APP_DIR)).toThrow(/STORE_TEST_MODE can't be false on staging/);
  });
  it("accepts only Razorpay test keys on staging", () => {
    const keys = { RAZORPAY_KEY_SECRET: "secret", RAZORPAY_WEBHOOK_SECRET: "hook" };
    expect(() => loadConfig({ ...STAGING, ...keys, RAZORPAY_KEY_ID: "rzp_live_ABC123" }, APP_DIR)).toThrow(/only Razorpay test keys/);
    expect(loadConfig({ ...STAGING, ...keys, RAZORPAY_KEY_ID: "rzp_test_ABC123" }, APP_DIR).razorpay?.mode).toBe("test");
  });
  it("uses its own host-only cookie names, never the live store's", () => {
    const c = loadConfig(STAGING, APP_DIR);
    expect(c.cookie.name).toBe("bya_staging_admin_session");
    expect(c.customer.cookie).toBe("bya_staging_customer_session");
    expect(c.cookie.domain).toBeUndefined();
    expect(c.cookie.secure).toBe(true);
    expect(() => loadConfig({ ...STAGING, COOKIE_NAME: "bya_admin_session" }, APP_DIR)).toThrow(/its own COOKIE_NAME/);
    expect(() => loadConfig({ ...STAGING, COOKIE_DOMAIN: ".beingyoualways.com" }, APP_DIR)).toThrow(/leave COOKIE_DOMAIN empty/);
    // the live store keeps its existing names
    expect(loadConfig({ ...STAGING, STORE_ENVIRONMENT: "production", CORS_ORIGINS: "https://beingyoualways.com", PUBLIC_SITE_URL: "https://beingyoualways.com" }, APP_DIR).cookie.name).toBe("bya_admin_session");
  });
  it("needs a list of test inboxes before staging may send real email", () => {
    expect(() => loadConfig({ ...STAGING, ...SMTP }, APP_DIR)).toThrow(/MAIL_ALLOWED_RECIPIENTS/);
    expect(() => loadConfig({ ...STAGING, ...SMTP, MAIL_ALLOWED_RECIPIENTS: "not-an-email" }, APP_DIR)).toThrow(/MAIL_ALLOWED_RECIPIENTS must be/);
    expect(loadConfig({ ...STAGING, ...SMTP, MAIL_ALLOWED_RECIPIENTS: "Owner@Example.com, @beingyoualways.com" }, APP_DIR).mailAllowList).toEqual(["owner@example.com", "@beingyoualways.com"]);
  });
  it("needs WhatsApp test numbers before staging may send WhatsApp", () => {
    expect(() => loadConfig({ ...STAGING, ...WA_ENV, WHATSAPP_TEST_RECIPIENTS: "" }, APP_DIR)).toThrow(/WHATSAPP_TEST_RECIPIENTS/);
    expect(loadConfig({ ...STAGING, ...WA_ENV }, APP_DIR).whatsapp?.testRecipients).toEqual(["919876500001"]);
  });
});

describe("staging email", () => {
  it("matches exact addresses and whole domains only", () => {
    const allow = ["owner@example.com", "@beingyoualways.com"];
    expect(mailAllowed(allow, "Owner@Example.com")).toBe(true);
    expect(mailAllowed(allow, "qa@beingyoualways.com")).toBe(true);
    expect(mailAllowed(allow, "someone@gmail.com")).toBe(false);
    expect(mailAllowed(allow, "x@evilbeingyoualways.com")).toBe(false);
  });
  it("keeps mail for anyone else in the outbox and never reports it as sent", async () => {
    const media = mkdtempSync(join(tmpdir(), "bya-staging-mail-"));
    const config = loadConfig({ ...STAGING, ...SMTP, MAIL_ALLOWED_RECIPIENTS: "owner@example.com", MEDIA_ROOT: media }, "/srv/app");
    const r = await createMailer(config, createLogger("silent")).send({ to: "real.customer@gmail.com", subject: "Confirm your email", text: "hello" });
    expect(r.delivered).toBe(false);
    expect(r.transport).toBe("outbox");
    const file = readdirSync(join(media, "outbox"))[0]!;
    expect(readFileSync(join(media, "outbox", file), "utf8")).toMatch(/Held: staging store/);
  });
});

describe("deploy:check provider answers", () => {
  it("reads Google's answer to an invalid code", () => {
    expect(interpretGoogleTokenProbe(400, { error: "invalid_grant" }).status).toBe("pass");
    expect(interpretGoogleTokenProbe(401, { error: "invalid_client" }).status).toBe("fail");
    expect(interpretGoogleTokenProbe(400, { error: "redirect_uri_mismatch" }).status).toBe("fail");
  });
  it("checks that our Meta app is subscribed to the business account", () => {
    expect(interpretSubscribedApps("123", { data: [{ whatsapp_business_api_data: { id: "123" } }] }).status).toBe("pass");
    expect(interpretSubscribedApps("123", { data: [] }).status).toBe("fail");
  });
});
