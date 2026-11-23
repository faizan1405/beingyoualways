import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { META_WHATSAPP } from "@/config/whatsapp";
import { orders, chatbotConfig } from "@/lib/mock-data";
import type { AbandonedCart, AbandonedCartSettings, Customer } from "@/lib/types";
import {
  OTP_POLICY, campaignRecipients, canRequestOtp, canVerifyOtp, checkSendingLimit, describeMetaError, emptyOtpState,
  mergeDeliveryState, orderNotification, recordFailedAttempt, recordOtpSent, reminderDecision, replyToText, toWhatsAppDigits,
} from "@/lib/whatsapp-cloud";
import { dedupe, parseWebhook, verifySignature, verifySubscription } from "@/lib/whatsapp-webhook";
import { offlineStatus } from "@/services/whatsappCloudService";

const at = (iso: string) => new Date(iso);

describe("Meta configuration", () => {
  it("uses the owner's App, Business Account and Phone Number IDs", () => {
    expect(META_WHATSAPP.appId).toBe("1393915615725367");
    expect(META_WHATSAPP.businessAccountId).toBe("1150649830611813");
    expect(META_WHATSAPP.phoneNumberId).toBe("873369352531284");
  });
  it("is never reported connected without the Hostinger backend", () => {
    expect(offlineStatus().state).toBe("backend-missing");
  });
});

describe("phone numbers", () => {
  it("turns Indian mobiles into 91XXXXXXXXXX and rejects masked demo numbers", () => {
    expect(toWhatsAppDigits("98765 43210")).toBe("919876543210");
    expect(toWhatsAppDigits("+91 98765-43210")).toBe("919876543210");
    expect(toWhatsAppDigits("+91 98XXX 10021")).toBeNull();
    expect(toWhatsAppDigits("12345")).toBeNull();
  });
});

describe("OTP limits", () => {
  const t0 = at("2026-11-23T10:00:00Z");
  it("code expires after 5 minutes", () => {
    const s = recordOtpSent(emptyOtpState(), t0);
    expect(canVerifyOtp(s, at("2026-11-23T10:04:59Z")).ok).toBe(true);
    expect(canVerifyOtp(s, at("2026-11-23T10:05:00Z"))).toMatchObject({ ok: false, reason: "expired" });
  });
  it("resend waits 60 seconds", () => {
    const s = recordOtpSent(emptyOtpState(), t0);
    expect(canRequestOtp(s, at("2026-11-23T10:00:30Z"))).toMatchObject({ ok: false, reason: "cooldown", retryInSeconds: 30 });
    expect(canRequestOtp(s, at("2026-11-23T10:01:00Z")).ok).toBe(true);
  });
  it("allows at most 3 codes per hour", () => {
    let s = emptyOtpState();
    for (const m of ["00", "02", "04"]) s = recordOtpSent(s, at(`2026-11-23T10:${m}:00Z`));
    expect(canRequestOtp(s, at("2026-11-23T10:10:00Z"))).toMatchObject({ ok: false, reason: "hourly-limit" });
    expect(canRequestOtp(s, at("2026-11-23T11:00:01Z")).ok).toBe(true);
  });
  it("locks for 15 minutes after 5 wrong codes", () => {
    let s = recordOtpSent(emptyOtpState(), t0);
    for (let i = 0; i < OTP_POLICY.maxAttempts - 1; i++) s = recordFailedAttempt(s, t0);
    expect(canVerifyOtp(s, t0).ok).toBe(true);
    s = recordFailedAttempt(s, t0);
    expect(canVerifyOtp(s, at("2026-11-23T10:14:00Z"))).toMatchObject({ ok: false, reason: "locked" });
    expect(canRequestOtp(s, at("2026-11-23T10:15:01Z")).ok).toBe(true);
  });
});

describe("order notifications", () => {
  it("shipped order uses order_shipped filled from the order", () => {
    const o = { ...orders[0]!, customerPhone: "9876543210", status: "shipped" as const };
    const n = orderNotification(o)!;
    expect(n.template).toBe("order_shipped");
    expect(n.params).toEqual(["Ananya", "BYA-1042", "Mumbai"]);
    expect(n.to).toBe("919876543210");
    expect(n.blocked).toBeNull();
  });
  it("new and returned orders get no message; masked numbers are blocked", () => {
    expect(orderNotification({ ...orders[0]!, status: "new" })).toBeNull();
    expect(orderNotification({ ...orders[0]!, status: "returned" })).toBeNull();
    expect(orderNotification({ ...orders[0]!, status: "delivered" })!.blocked).not.toBeNull();
  });
});

describe("abandoned cart reminder", () => {
  const settings: AbandonedCartSettings = { enabled: true, delayHours: 6, template: "{cart_link}", includeDiscount: false, discountCode: "" };
  const cart: AbandonedCart = { id: "k1", customerName: "A", phone: "9876543210", items: [], abandonedAt: "2026-11-23T00:00:00Z", whatsappConsent: true };
  const none = new Set<string>();
  it("is due only 6 hours after the cart was left", () => {
    expect(reminderDecision(cart, settings, at("2026-11-23T05:59:00Z"), none)).toBe("waiting");
    expect(reminderDecision(cart, settings, at("2026-11-23T06:00:00Z"), none)).toBe("due");
  });
  it("needs consent, stops after checkout and never repeats", () => {
    const later = at("2026-11-23T07:00:00Z");
    expect(reminderDecision({ ...cart, whatsappConsent: null }, settings, later, none)).toBe("no-consent");
    expect(reminderDecision({ ...cart, checkedOutAt: "2026-11-23T03:00:00Z" }, settings, later, none)).toBe("checked-out");
    expect(reminderDecision(cart, settings, later, new Set(["k1"]))).toBe("already-sent");
    expect(reminderDecision(cart, { ...settings, enabled: false }, later, none)).toBe("off");
  });
});

describe("campaigns", () => {
  const c = (id: string, p: Partial<Customer>): Customer => ({ id, name: id, email: "", phone: "9876543210", joinedAt: "", addresses: [], segment: "new", totalSpent: 0, orderCount: 0, status: "active", notes: "", signInMethod: null, isDemo: true, ...p });
  it("only opted-in, active customers with a real number are recipients", () => {
    const r = campaignRecipients([c("a", { whatsappOptIn: "opted-in" }), c("b", { whatsappOptIn: "opted-out" }), c("c", {}), c("d", { whatsappOptIn: "opted-in", status: "blocked" }), c("e", { whatsappOptIn: "opted-in", phone: "98XXX" })]);
    expect(r.eligible.map((x) => x.id)).toEqual(["a"]);
    expect(r.optedOut).toBe(1);
    expect(r.notAsked).toBe(1);
    expect(r.noNumber).toBe(1);
  });
  it("blocks sends over the daily limit and when the limit is unknown", () => {
    expect(checkSendingLimit(300, 250).ok).toBe(false);
    expect(checkSendingLimit(200, 250).ok).toBe(true);
    expect(checkSendingLimit(1, null).ok).toBe(false);
  });
});

describe("delivery status", () => {
  it("a late 'sent' never overwrites delivered or read", () => {
    expect(mergeDeliveryState("read", "sent")).toBe("read");
    expect(mergeDeliveryState("delivered", "sent")).toBe("delivered");
    expect(mergeDeliveryState("sent", "read")).toBe("read");
    expect(mergeDeliveryState("sent", "failed")).toBe("failed");
    expect(mergeDeliveryState("read", "failed")).toBe("read");
  });
  it("explains an expired token (190)", () => {
    expect(describeMetaError(190)).toMatch(/expired or invalid/);
  });
});

describe("webhook", () => {
  it("answers Meta's handshake only with the right verify token", () => {
    const q = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "secret-123", "hub.challenge": "42" });
    expect(verifySubscription(q, "secret-123")).toBe("42");
    expect(verifySubscription(q, "other")).toBeNull();
  });
  it("accepts a correct signature and rejects a tampered body", async () => {
    const body = JSON.stringify({ entry: [] });
    const sig = "sha256=" + createHmac("sha256", "app-secret").update(body).digest("hex");
    expect(await verifySignature(body, sig, "app-secret")).toBe(true);
    expect(await verifySignature(body + " ", sig, "app-secret")).toBe(false);
    expect(await verifySignature(body, null, "app-secret")).toBe(false);
  });
  it("parses statuses and drops repeated deliveries", () => {
    const payload = { entry: [{ id: "w", changes: [{ field: "messages", value: { statuses: [{ id: "wamid.1", status: "delivered", timestamp: "1700000000", recipient_id: "919876543210" }] } }] }] };
    const seen = new Set<string>();
    const first = dedupe(parseWebhook(payload), seen);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ kind: "status", messageId: "wamid.1", status: "delivered" });
    expect(dedupe(parseWebhook(payload), seen)).toHaveLength(0);
  });
});

describe("chatbot routing", () => {
  it("routes topics and hands unclear messages to a person", () => {
    expect(replyToText("what is your refund policy", chatbotConfig, "x.com").reply).toContain("refund-policy");
    expect(replyToText("shipping time?", chatbotConfig, "x.com").reply).toContain("shipping-policy");
    expect(replyToText("where is BYA-1042", chatbotConfig, "x.com").reply).toContain("BYA-1042");
    expect(replyToText("qwerty", chatbotConfig, "x.com").handoff).toBe(true);
  });
});
