// WhatsApp Business Cloud API rules shared by the server's WhatsApp services. Pure functions only:
// no network, no database, no secrets.
import { createHmac, timingSafeEqual } from "node:crypto";

import { isIndianMobile, normalizeIndianPhone } from "./india.js";

/* ───────────────────────────── phone numbers ───────────────────────────── */

/** E.164 digits without "+" (what Meta expects) for an Indian mobile, or null when unusable. */
export function toWaDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const d = normalizeIndianPhone(phone);
  return isIndianMobile(d) ? `91${d}` : null;
}

/** The 10-digit local number for a WhatsApp sender ("919876543210" → "9876543210"), or null. */
export const localFromWa = (wa: string) => (/^91[6-9]\d{9}$/.test(wa) ? wa.slice(2) : null);

/** +91 98•••••210 — what lists show to staff without customer access. */
export const maskPhone = (wa: string) => (wa.length >= 6 ? `+${wa.slice(0, 2)} ${wa.slice(2, 4)}•••••${wa.slice(-3)}` : "•••");

/* ───────────────────────────── template purposes ───────────────────────────── */

export type TemplateCategory = "AUTHENTICATION" | "UTILITY" | "MARKETING";
export interface PurposeDef { label: string; category: TemplateCategory; defaultName: string; vars: string[]; suggested: string }

/**
 * Every message the store can send and the variables it fills, in order. The admin maps each purpose
 * to the exact template name approved in WhatsApp Manager; the server only sends a purpose whose
 * template Meta reports APPROVED with the same number of variables.
 */
export const PURPOSES = {
  otp: { label: "WhatsApp sign-in code", category: "AUTHENTICATION", defaultName: "login_otp", vars: ["code"], suggested: "{{1}} is your verification code. For your security, do not share this code. (Authentication template with a Copy code button.)" },
  order_confirmation: { label: "Order confirmed", category: "UTILITY", defaultName: "order_confirmation", vars: ["first_name", "order_number", "order_total"], suggested: "Hi {{1}}, your Being You – Always order {{2}} for {{3}} is confirmed. We will keep you updated here as it moves along." },
  payment_confirmation: { label: "Payment received", category: "UTILITY", defaultName: "payment_confirmation", vars: ["first_name", "amount_paid", "order_number"], suggested: "Hi {{1}}, we have received your payment of {{2}} for order {{3}}. Thank you — we will message you when it ships." },
  cod_order_confirmation: { label: "Cash on Delivery order placed", category: "UTILITY", defaultName: "cod_order_confirmation", vars: ["first_name", "order_number", "amount_to_pay"], suggested: "Hi {{1}}, thank you for your order {{2}}. Please keep {{3}} ready to pay in cash when it is delivered." },
  order_packed: { label: "Order packed", category: "UTILITY", defaultName: "order_packed", vars: ["first_name", "order_number"], suggested: "Hi {{1}}, your order {{2}} has been packed by our team and will be handed to the courier soon." },
  order_shipped: { label: "Order shipped", category: "UTILITY", defaultName: "order_shipped", vars: ["first_name", "order_number", "order_link"], suggested: "Hi {{1}}, your order {{2}} has been shipped. Track it and see the courier details here: {{3}}" },
  order_out_for_delivery: { label: "Out for delivery", category: "UTILITY", defaultName: "order_out_for_delivery", vars: ["first_name", "order_number"], suggested: "Hi {{1}}, your order {{2}} is out for delivery today. Please keep your phone close so the courier can reach you." },
  order_delivered: { label: "Order delivered", category: "UTILITY", defaultName: "order_delivered", vars: ["first_name", "order_number"], suggested: "Hi {{1}}, your order {{2}} has been delivered. Reply here if anything is not right with your order." },
  order_cancelled: { label: "Order cancelled", category: "UTILITY", defaultName: "order_cancelled", vars: ["first_name", "order_number"], suggested: "Hi {{1}}, your order {{2}} has been cancelled. If you did not ask for this, please reply here and our team will help." },
  abandoned_cart: { label: "Bag reminder (6 hours)", category: "MARKETING", defaultName: "abandoned_cart_reminder", vars: ["first_name", "cart_link"], suggested: "Hi {{1}}, you left a few things in your bag at Being You – Always. They are waiting for you here: {{2}} Reply STOP to opt out." },
  test: { label: "Connection test message", category: "UTILITY", defaultName: "hello_world", vars: [], suggested: "Meta's sample template (exists on every new WhatsApp Business account)." },
} as const satisfies Record<string, PurposeDef>;
export type Purpose = keyof typeof PURPOSES;
export const PURPOSE_KEYS = Object.keys(PURPOSES) as Purpose[];
export type OrderPurpose = "order_confirmation" | "payment_confirmation" | "cod_order_confirmation" | "order_packed" | "order_shipped" | "order_out_for_delivery" | "order_delivered" | "order_cancelled";

/** Consent purposes stored in WhatsAppConsent. */
/**
 * order_updates: order news. marketing: offers + campaigns (+ bag reminders).
 * cart_reminder: only the one bag reminder, chosen on the bag page — never used for campaigns.
 */
export const CONSENT = { orderUpdates: "order_updates", marketing: "marketing", cartReminder: "cart_reminder" } as const;
export type ConsentPurpose = (typeof CONSENT)[keyof typeof CONSENT];

/* ───────────────────────────── template shape (from Meta) ───────────────────────────── */

export type TemplateStatus = "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "DISABLED" | "IN_APPEAL" | "PENDING_DELETION" | "DELETED" | "LIMIT_EXCEEDED" | string;

export interface MetaTemplate {
  id?: string;
  name: string;
  language: string;
  status: TemplateStatus;
  category: string;
  components?: { type: string; format?: string; text?: string; buttons?: { type: string; text?: string; url?: string; otp_type?: string }[] }[];
}

export interface TemplateShape {
  bodyVars: number;
  /** index of a URL button whose address ends in a variable (OTP copy-code buttons are URL buttons too) */
  urlButtonIndex: number | null;
  /** header with a variable or media — the server doesn't fill those, so the template can't be used */
  unsupportedHeader: boolean;
}

const countVars = (text: string | undefined) => {
  const nums = [...(text ?? "").matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => Number(m[1]));
  return nums.length ? Math.max(...nums) : 0;
};

export function templateShape(t: MetaTemplate): TemplateShape {
  const comps = t.components ?? [];
  const body = comps.find((c) => c.type?.toUpperCase() === "BODY");
  const header = comps.find((c) => c.type?.toUpperCase() === "HEADER");
  const buttons = comps.find((c) => c.type?.toUpperCase() === "BUTTONS")?.buttons ?? [];
  const urlIdx = buttons.findIndex((b) => (b.type?.toUpperCase() === "URL" && /\{\{\s*1\s*\}\}/.test(b.url ?? "")) || b.type?.toUpperCase() === "OTP");
  const unsupportedHeader = !!header && ((header.format ?? "TEXT").toUpperCase() !== "TEXT" || countVars(header.text) > 0);
  return { bodyVars: countVars(body?.text), urlButtonIndex: urlIdx >= 0 ? urlIdx : null, unsupportedHeader };
}

export interface TemplateValues {
  /** body {{1}}, {{2}}… in order */
  body: string[];
  /** value for a URL button variable (OTP code, recovery token) */
  button?: string;
}

/** Meta's `components` for a send, or a plain reason the template can't take these values. */
export function buildComponents(shape: TemplateShape, values: TemplateValues): { ok: true; components: unknown[] } | { ok: false; reason: string } {
  if (shape.unsupportedHeader) return { ok: false, reason: "The template has a header with a variable, image or document, which the store doesn't fill. Use a template with a plain-text header or none." };
  if (shape.bodyVars !== values.body.length) return { ok: false, reason: `The approved template has ${shape.bodyVars} variable(s) but this message needs ${values.body.length}. Create a template with exactly ${values.body.length}.` };
  if (values.body.some((v) => !v.trim())) return { ok: false, reason: "A template variable is empty, so the message wasn't sent." };
  const components: unknown[] = [];
  if (values.body.length) components.push({ type: "body", parameters: values.body.map((text) => ({ type: "text", text: text.slice(0, 1000) })) });
  if (shape.urlButtonIndex !== null) {
    if (!values.button) return { ok: false, reason: "The template has a link button with a variable, but this message has no value for it." };
    components.push({ type: "button", sub_type: "url", index: String(shape.urlButtonIndex), parameters: [{ type: "text", text: values.button }] });
  }
  return { ok: true, components };
}

/* ───────────────────────────── webhooks ───────────────────────────── */

/** X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(app secret, exact raw body), compared in constant time. */
export function verifyMetaSignature(raw: Buffer, header: string | undefined, appSecret: string): boolean {
  if (!header || !header.startsWith("sha256=")) return false;
  const given = Buffer.from(header.slice(7), "hex");
  const expected = createHmac("sha256", appSecret).update(raw).digest();
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/* ───────────────────────────── delivery states ───────────────────────────── */

export type DeliveryState = "ACCEPTED" | "SENT" | "DELIVERED" | "READ" | "FAILED";
const RANK: Record<DeliveryState, number> = { ACCEPTED: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 1 };

/** Apply a webhook status: an older "sent" never overwrites "delivered"/"read"; "failed" only before delivery. */
export function mergeDeliveryState(current: DeliveryState, incoming: DeliveryState): DeliveryState {
  if (incoming === "FAILED") return current === "DELIVERED" || current === "READ" ? current : "FAILED";
  if (current === "FAILED") return incoming === "DELIVERED" || incoming === "READ" ? incoming : current;
  return RANK[incoming] > RANK[current] ? incoming : current;
}

export const metaStatusToState = (s: string): DeliveryState | null =>
  ({ sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED" } as Record<string, DeliveryState>)[s] ?? null;

/* ───────────────────────────── Meta errors ───────────────────────────── */

const META_ERRORS: Record<number, string> = {
  190: "Access token expired or revoked — the owner must issue a new System User token and update WHATSAPP_ACCESS_TOKEN on the server.",
  10: "The token is missing a permission (needs whatsapp_business_messaging and whatsapp_business_management).",
  200: "The token is missing a permission (needs whatsapp_business_messaging and whatsapp_business_management).",
  100: "Meta rejected a parameter in the request.",
  4: "Too many API calls — Meta is rate limiting the app.",
  80007: "WhatsApp Business account rate limit reached.",
  130429: "Throughput limit reached — sending slows down automatically.",
  130472: "Meta held this message back as part of an experiment for this customer.",
  131000: "Meta reported an unknown error; it will be retried.",
  131005: "Access denied — the token can't use this phone number.",
  131008: "A required parameter is missing.",
  131009: "A parameter value is not valid.",
  131016: "WhatsApp is temporarily unavailable; it will be retried.",
  131021: "The recipient is the business number itself.",
  131026: "Message could not be delivered (number not on WhatsApp, or hasn't accepted the latest terms).",
  131030: "Recipient isn't on the allowed test list for this number.",
  131031: "The business account is locked or restricted by Meta.",
  131042: "Payment problem on the WhatsApp Business account (add or fix the payment method in Meta Business Settings).",
  131047: "More than 24 hours since the customer's last message — only an approved template can be sent.",
  131049: "Meta didn't deliver this marketing message to keep the customer's experience healthy (per-user marketing limit).",
  131050: "The customer has stopped marketing messages from this business on WhatsApp.",
  131051: "This message type isn't supported.",
  131056: "Too many messages to this customer in a short time.",
  132000: "Template variable count doesn't match the approved template.",
  132001: "Template doesn't exist or isn't approved in this language.",
  132005: "Template text is too long after filling the variables.",
  132007: "Template content breaks WhatsApp policy.",
  132015: "Template is paused because of low quality.",
  132016: "Template is disabled because of low quality.",
  133010: "The phone number isn't registered with the Cloud API.",
  368: "Temporarily blocked for policy violations.",
};
export const describeMetaError = (code: number | null | undefined, fallback = "WhatsApp error") =>
  code == null ? fallback : META_ERRORS[code] ?? `${fallback} (code ${code}).`;

const TRANSIENT = new Set([1, 2, 4, 17, 341, 80007, 130429, 131000, 131016, 131056, 133004]);
export type ErrorKind = "token" | "permission" | "transient" | "permanent";
export function classifyMetaError(httpStatus: number | null, code: number | null): ErrorKind {
  if (code === 190) return "token";
  if (code === 10 || (code !== null && code >= 200 && code <= 299) || code === 131005) return "permission";
  if ((code !== null && TRANSIENT.has(code)) || httpStatus === null || httpStatus >= 500 || httpStatus === 429) return "transient";
  return "permanent";
}

/** Minutes to wait before attempt n+1 of a queued message (persistent, survives restarts). */
export const BACKOFF_MINUTES = [1, 5, 30, 120] as const;
export const MAX_SEND_ATTEMPTS = BACKOFF_MINUTES.length + 1;
export const backoffMs = (attemptsSoFar: number) => (BACKOFF_MINUTES[Math.min(attemptsSoFar - 1, BACKOFF_MINUTES.length - 1)] ?? 120) * 60_000;

/* ───────────────────────────── messaging tiers ───────────────────────────── */

/** messaging_limit_tier → business-initiated conversations per rolling 24 h (null = unknown / unlimited). */
export function tierLimit(tier: string | null | undefined): number | null {
  switch (tier) {
    case "TIER_50": return 50;
    case "TIER_250": return 250;
    case "TIER_1K": return 1_000;
    case "TIER_2K": return 2_000;
    case "TIER_10K": return 10_000;
    case "TIER_100K": return 100_000;
    default: return null;
  }
}

/* ───────────────────────────── chatbot intents ───────────────────────────── */

export type ChatIntent = "opt-out" | "opt-in" | "order-tracking" | "refund" | "shipping" | "support" | "product" | "greeting" | "unknown";

const INTENTS: [ChatIntent, RegExp][] = [
  ["opt-out", /^\s*(stop|unsubscribe|stop all|opt out|optout)\s*[.!]*\s*$/i],
  ["opt-in", /^\s*(start|subscribe|unstop|opt in)\s*[.!]*\s*$/i],
  ["order-tracking", /\bBYA-?\d{6}-?[A-Z0-9]{5}\b|\b(track|tracking|where is my|order status|my order|status of)\b/i],
  ["refund", /\b(refund|return|exchange|money back|damaged|wrong item)\b/i],
  ["shipping", /\b(ship|shipping|deliver|delivery|courier|dispatch|pincode|pin code)\b/i],
  ["support", /\b(human|agent|person|someone|team|support|call me|talk to|complaint|help)\b/i],
  ["product", /\b(product|products|serum|oil|mask|wash|cream|lotion|lipstick|kajal|sunscreen|soap|scrub|gel|shampoo|wax|price|cost|buy|shop|skin|hair|acne|tan)\b/i],
  ["greeting", /^\s*(hi+|hello|hey|namaste|good (morning|afternoon|evening)|menu)\b/i],
];
export const detectIntent = (text: string): ChatIntent => INTENTS.find(([, re]) => re.test(text))?.[0] ?? "unknown";

/** Order number written in a message (BYA-YYMMDD-XXXXX, dashes optional), normalised. */
export function orderNumberIn(text: string): string | null {
  const m = /\bBYA-?(\d{6})-?([A-Z0-9]{5})\b/i.exec(text);
  return m ? `BYA-${m[1]}-${m[2]!.toUpperCase()}` : null;
}

/** Words worth searching the catalogue for (drops filler words). */
export function productKeywords(text: string): string[] {
  const stop = new Set(["the", "a", "an", "is", "do", "you", "have", "for", "of", "and", "or", "to", "in", "what", "which", "price", "cost", "buy", "want", "need", "please", "any", "your", "my", "me", "i", "can", "how", "much", "product", "products", "show", "about", "best", "good", "shop"]);
  return [...new Set(text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !stop.has(w)))].slice(0, 5);
}
