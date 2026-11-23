import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { ConfigError, loadConfig } from "../../src/config.js";
import {
  buildComponents, classifyMetaError, detectIntent, maskPhone, mergeDeliveryState, orderNumberIn, templateShape, tierLimit, toWaDigits, verifyMetaSignature,
} from "../../src/lib/whatsapp.js";
import { MetaApiError, createGraphClient } from "../../src/services/whatsappGraph.js";
import { WA_ENV } from "../support/fakeMeta.js";

const base = { NODE_ENV: "test", DATABASE_URL: "mysql://u:p@localhost:3306/bya_test" };

describe("WhatsApp configuration", () => {
  it("is off without variables and all-or-nothing when partly set", () => {
    expect(loadConfig(base).whatsapp).toBeNull();
    expect(() => loadConfig({ ...base, WHATSAPP_ACCESS_TOKEN: WA_ENV.WHATSAPP_ACCESS_TOKEN })).toThrow(/partly configured/);
    const c = loadConfig({ ...base, ...WA_ENV });
    expect(c.whatsapp).toMatchObject({ phoneNumberId: WA_ENV.WHATSAPP_PHONE_NUMBER_ID, graphVersion: "v25.0", testRecipients: ["919876500001"] });
  });
  it("accepts the older variable names and refuses swapped or weak values", () => {
    const { WHATSAPP_WABA_ID, WHATSAPP_WEBHOOK_VERIFY_TOKEN, ...rest } = WA_ENV;
    expect(loadConfig({ ...base, ...rest, WHATSAPP_BUSINESS_ACCOUNT_ID: WHATSAPP_WABA_ID, WHATSAPP_VERIFY_TOKEN: WHATSAPP_WEBHOOK_VERIFY_TOKEN }).whatsapp?.wabaId).toBe(WHATSAPP_WABA_ID);
    expect(() => loadConfig({ ...base, ...WA_ENV, WHATSAPP_PHONE_NUMBER_ID: WA_ENV.WHATSAPP_WABA_ID })).toThrow(ConfigError);
    expect(() => loadConfig({ ...base, ...WA_ENV, WHATSAPP_WEBHOOK_VERIFY_TOKEN: "short" })).toThrow(/at least 20/);
    expect(() => loadConfig({ ...base, ...WA_ENV, WHATSAPP_GRAPH_API_VERSION: "25" })).toThrow(/v25.0/);
    expect(() => loadConfig({ ...base, ...WA_ENV, WHATSAPP_TEST_RECIPIENTS: "12345" })).toThrow(/TEST_RECIPIENTS/);
  });
});

describe("webhook signature", () => {
  const secret = "0123456789abcdef0123456789abcdef";
  const raw = Buffer.from('{"object":"whatsapp_business_account"}');
  const sig = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  it("accepts the exact body and rejects any change, a wrong secret or a missing header", () => {
    expect(verifyMetaSignature(raw, sig, secret)).toBe(true);
    expect(verifyMetaSignature(Buffer.from('{"object":"whatsapp_business_account" }'), sig, secret)).toBe(false);
    expect(verifyMetaSignature(raw, sig, "f".repeat(32))).toBe(false);
    expect(verifyMetaSignature(raw, undefined, secret)).toBe(false);
    expect(verifyMetaSignature(raw, "sha1=abc", secret)).toBe(false);
  });
});

describe("delivery status order", () => {
  it("never goes backwards and keeps 'failed' unless delivery is later reported", () => {
    expect(mergeDeliveryState("DELIVERED", "SENT")).toBe("DELIVERED");
    expect(mergeDeliveryState("READ", "DELIVERED")).toBe("READ");
    expect(mergeDeliveryState("ACCEPTED", "FAILED")).toBe("FAILED");
    expect(mergeDeliveryState("DELIVERED", "FAILED")).toBe("DELIVERED");
    expect(mergeDeliveryState("FAILED", "SENT")).toBe("FAILED");
    expect(mergeDeliveryState("FAILED", "READ")).toBe("READ");
  });
});

describe("templates", () => {
  const otp = templateShape({ name: "login_otp", language: "en", status: "APPROVED", category: "AUTHENTICATION", components: [{ type: "BODY", text: "*{{1}}* is your code." }, { type: "BUTTONS", buttons: [{ type: "URL", url: "https://www.whatsapp.com/otp/code/?code=otp{{1}}" }] }] });
  it("reads variable counts and link buttons from Meta's template", () => {
    expect(otp).toEqual({ bodyVars: 1, urlButtonIndex: 0, unsupportedHeader: false });
    expect(templateShape({ name: "x", language: "en", status: "APPROVED", category: "MARKETING", components: [{ type: "HEADER", format: "IMAGE" }, { type: "BODY", text: "Hi" }] }).unsupportedHeader).toBe(true);
  });
  it("builds Meta's components and refuses a variable-count mismatch", () => {
    expect(buildComponents(otp, { body: ["123456"], button: "123456" })).toEqual({ ok: true, components: [
      { type: "body", parameters: [{ type: "text", text: "123456" }] },
      { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "123456" }] },
    ] });
    const bad = buildComponents({ bodyVars: 3, urlButtonIndex: null, unsupportedHeader: false }, { body: ["a", "b"] });
    expect(bad.ok).toBe(false);
    expect(buildComponents({ bodyVars: 1, urlButtonIndex: null, unsupportedHeader: false }, { body: [" "] }).ok).toBe(false);
  });
  it("maps Meta messaging tiers to daily limits", () => {
    expect(tierLimit("TIER_250")).toBe(250);
    expect(tierLimit("TIER_1K")).toBe(1000);
    expect(tierLimit(undefined)).toBeNull();
  });
});

describe("Meta errors", () => {
  it("classifies token, permission, temporary and permanent errors", () => {
    expect(classifyMetaError(401, 190)).toBe("token");
    expect(classifyMetaError(403, 200)).toBe("permission");
    expect(classifyMetaError(400, 130429)).toBe("transient");
    expect(classifyMetaError(503, null)).toBe("transient");
    expect(classifyMetaError(400, 132001)).toBe("permanent");
  });
  it("the Graph client sends the token only in the Authorization header and reports Meta's error", async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const g = createGraphClient(loadConfig({ ...base, ...WA_ENV }).whatsapp!, async (url, init) => {
      calls.push({ url, headers: init.headers });
      return { ok: false, status: 401, text: async () => JSON.stringify({ error: { message: "Error validating access token", code: 190, fbtrace_id: "ABC" } }) };
    });
    const e = await g.get("t", "873369352531284", { fields: "id" }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(MetaApiError);
    expect((e as MetaApiError).kind).toBe("token");
    expect((e as MetaApiError).reason).toMatch(/expired or revoked/);
    expect(calls[0]!.url).toBe("https://graph.facebook.com/v25.0/873369352531284?fields=id");
    expect(calls[0]!.url).not.toContain(WA_ENV.WHATSAPP_ACCESS_TOKEN);
    expect(calls[0]!.headers["Authorization"]).toBe(`Bearer ${WA_ENV.WHATSAPP_ACCESS_TOKEN}`);
  });
  it("a timeout is marked ambiguous (never resent automatically)", async () => {
    const g = createGraphClient(loadConfig({ ...base, ...WA_ENV }).whatsapp!, async () => { const e = new Error("t"); e.name = "TimeoutError"; throw e; });
    const e = (await g.post("t", "x/messages", {}).catch((x: unknown) => x)) as MetaApiError;
    expect(e.ambiguous).toBe(true);
  });
});

describe("numbers and chatbot topics", () => {
  it("normalises Indian numbers and masks them", () => {
    expect(toWaDigits("+91 98765 43210")).toBe("919876543210");
    expect(toWaDigits("098765 43210")).toBe("919876543210");
    expect(toWaDigits("12345")).toBeNull();
    expect(maskPhone("919876543210")).toBe("+91 98•••••210");
  });
  it("recognises STOP, order numbers and topics", () => {
    expect(detectIntent("STOP")).toBe("opt-out");
    expect(detectIntent("stop sending me things please")).not.toBe("opt-out");
    expect(detectIntent("where is my order")).toBe("order-tracking");
    expect(orderNumberIn("status of bya-261123-ab2cd?")).toBe("BYA-261123-AB2CD");
    expect(detectIntent("I want a refund")).toBe("refund");
    expect(detectIntent("shipping to 560001?")).toBe("shipping");
    expect(detectIntent("hi")).toBe("greeting");
    expect(detectIntent("my parcel box was open")).toBe("unknown");
  });
});
