// WhatsApp Cloud API business rules shared by the admin screens and (later) the
// Hostinger backend. Pure functions only: no network, no tokens, no storage.
import type { AbandonedCart, AbandonedCartSettings, ChatbotConfig, Customer, Order, OrderStatus } from "@/lib/types";

/* ------------------------------------------------------------------ phone numbers */

/** E.164 digits without "+" (what Meta expects), or null if the number can't be used. */
export function toWhatsAppDigits(phone: string): string | null {
  if (/x/i.test(phone)) return null; // masked demo numbers
  const d = phone.replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(d)) return `91${d}`;
  if (/^91[6-9]\d{9}$/.test(d)) return d;
  if (/^0[6-9]\d{9}$/.test(d)) return `91${d.slice(1)}`;
  return null;
}

/* ------------------------------------------------------------------ templates */

export type TemplateCategory = "AUTHENTICATION" | "UTILITY" | "MARKETING";
export type TemplateStatus = "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "DISABLED";

export interface RequiredTemplate {
  name: string;
  category: TemplateCategory;
  purpose: string;
  /** What each {{n}} is filled with, in order. */
  variables: string[];
  /** Suggested body to submit to Meta for approval. */
  body: string;
}

/** Templates the site needs Meta to approve. Names must match exactly on WhatsApp Manager. */
export const REQUIRED_TEMPLATES: RequiredTemplate[] = [
  { name: "login_otp", category: "AUTHENTICATION", purpose: "Sign-in code", variables: ["code"], body: "{{1}} is your verification code. For your security, do not share this code." },
  { name: "order_confirmation", category: "UTILITY", purpose: "Order confirmed", variables: ["name", "order_id", "order_total"], body: "Hi {{1}}, thank you for shopping with Being You – Always. Your order {{2}} for {{3}} is confirmed and we will keep you updated here as it moves along." },
  { name: "order_processing", category: "UTILITY", purpose: "Order being packed", variables: ["name", "order_id"], body: "Hi {{1}}, your order {{2}} is now being prepared by our team. We will message you again as soon as it has been handed to the courier." },
  { name: "order_shipped", category: "UTILITY", purpose: "Order shipped", variables: ["name", "order_id", "city"], body: "Hi {{1}}, good news! Your order {{2}} has been shipped to {{3}}. Reply to this message if you need any help with your delivery." },
  { name: "order_delivered", category: "UTILITY", purpose: "Order delivered", variables: ["name", "order_id"], body: "Hi {{1}}, your order {{2}} has been delivered. We hope you enjoy your products — reply here if anything is not right with your order." },
  { name: "order_cancelled", category: "UTILITY", purpose: "Order cancelled", variables: ["name", "order_id"], body: "Hi {{1}}, your order {{2}} has been cancelled. If you did not ask for this or have any questions, please reply to this message and our team will help." },
  { name: "abandoned_cart_reminder", category: "MARKETING", purpose: "6-hour bag reminder", variables: ["name", "cart_link"], body: "Hi {{1}}, you left a few things in your bag at Being You – Always. They are still waiting for you here: {{2}}. Reply STOP to opt out." },
  { name: "new_launch", category: "MARKETING", purpose: "Campaign: new product", variables: ["name", "store_url"], body: "Hi {{1}}, something new has just arrived at Being You – Always. Take a look at the latest addition here: {{2}}. Reply STOP to opt out." },
  { name: "restock", category: "MARKETING", purpose: "Campaign: back in stock", variables: ["name", "store_url"], body: "Hi {{1}}, a favourite of our customers is available to order again at Being You – Always. Shop it here before it goes: {{2}}. Reply STOP to opt out." },
  { name: "winback", category: "MARKETING", purpose: "Campaign: we miss you", variables: ["name", "store_url"], body: "Hi {{1}}, it has been a while since your last visit to Being You – Always. Your skin and hair rituals are waiting for you here: {{2}}. Reply STOP to opt out." },
];

export const templateByName = (name: string) => REQUIRED_TEMPLATES.find((t) => t.name === name);

/** Fill {{1}}, {{2}}… in order. Missing values stay visible so mistakes show in previews. */
export const fillPositional = (body: string, params: string[]) => body.replace(/\{\{(\d+)\}\}/g, (m, n: string) => params[Number(n) - 1] ?? m);

/** A template can only be sent when Meta reports it APPROVED. Unknown status = not usable. */
export const isTemplateUsable = (name: string, statuses: Record<string, TemplateStatus>) => statuses[name] === "APPROVED";

/* ------------------------------------------------------------------ order notifications */

export const ORDER_TEMPLATE: Partial<Record<OrderStatus, string>> = {
  confirmed: "order_confirmation",
  processing: "order_processing",
  shipped: "order_shipped",
  delivered: "order_delivered",
  cancelled: "order_cancelled",
};

export interface OrderNotification {
  template: string;
  params: string[];
  preview: string;
  to: string | null;
  /** Why it can't be sent (null = ready for the backend). */
  blocked: string | null;
}

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** The WhatsApp update for an order at a status, built from the order's own data. */
export function orderNotification(order: Order, status: OrderStatus = order.status): OrderNotification | null {
  const name = ORDER_TEMPLATE[status];
  const t = name ? templateByName(name) : undefined;
  if (!t) return null;
  const values: Record<string, string> = {
    name: order.customerName.split(" ")[0] ?? order.customerName,
    order_id: order.id,
    order_total: order.shipping == null ? `${rupees(order.total)} (before shipping)` : rupees(order.total),
    city: order.shippingAddress.city,
  };
  const params = t.variables.map((v) => values[v] ?? "");
  const to = toWhatsAppDigits(order.customerPhone);
  return { template: t.name, params, preview: fillPositional(t.body, params), to, blocked: to ? null : "The customer's number is missing or masked." };
}

/* ------------------------------------------------------------------ OTP sign-in */

export const OTP_POLICY = {
  codeLength: 6,
  expirySeconds: 300,
  resendCooldownSeconds: 60,
  maxSendsPerHour: 3,
  maxAttempts: 5,
  lockoutMinutes: 15,
} as const;

export interface OtpState {
  /** ISO times of codes sent in the last hour. */
  sends: string[];
  failedAttempts: number;
  expiresAt?: string | undefined;
  lockedUntil?: string | undefined;
}

export const emptyOtpState = (): OtpState => ({ sends: [], failedAttempts: 0 });

export type OtpCheck = { ok: true } | { ok: false; reason: "cooldown" | "hourly-limit" | "locked" | "expired" | "no-code"; retryInSeconds: number };

const secs = (ms: number) => Math.max(0, Math.ceil(ms / 1000));

export function canRequestOtp(s: OtpState, now = new Date()): OtpCheck {
  const t = now.getTime();
  if (s.lockedUntil && new Date(s.lockedUntil).getTime() > t) return { ok: false, reason: "locked", retryInSeconds: secs(new Date(s.lockedUntil).getTime() - t) };
  const recent = s.sends.map((x) => new Date(x).getTime()).filter((x) => t - x < 3_600_000).sort((a, b) => a - b);
  const last = recent[recent.length - 1];
  if (last !== undefined && t - last < OTP_POLICY.resendCooldownSeconds * 1000) return { ok: false, reason: "cooldown", retryInSeconds: secs(OTP_POLICY.resendCooldownSeconds * 1000 - (t - last)) };
  const first = recent[0];
  if (recent.length >= OTP_POLICY.maxSendsPerHour && first !== undefined) return { ok: false, reason: "hourly-limit", retryInSeconds: secs(3_600_000 - (t - first)) };
  return { ok: true };
}

export function recordOtpSent(s: OtpState, now = new Date()): OtpState {
  const t = now.getTime();
  return { sends: [...s.sends.filter((x) => t - new Date(x).getTime() < 3_600_000), now.toISOString()], failedAttempts: 0, expiresAt: new Date(t + OTP_POLICY.expirySeconds * 1000).toISOString() };
}

export function canVerifyOtp(s: OtpState, now = new Date()): OtpCheck {
  const t = now.getTime();
  if (s.lockedUntil && new Date(s.lockedUntil).getTime() > t) return { ok: false, reason: "locked", retryInSeconds: secs(new Date(s.lockedUntil).getTime() - t) };
  if (!s.expiresAt) return { ok: false, reason: "no-code", retryInSeconds: 0 };
  if (new Date(s.expiresAt).getTime() <= t) return { ok: false, reason: "expired", retryInSeconds: 0 };
  return { ok: true };
}

/** A wrong code: after maxAttempts the number is locked and the code is void. */
export function recordFailedAttempt(s: OtpState, now = new Date()): OtpState {
  const failedAttempts = s.failedAttempts + 1;
  if (failedAttempts < OTP_POLICY.maxAttempts) return { ...s, failedAttempts };
  return { ...s, failedAttempts, expiresAt: undefined, lockedUntil: new Date(now.getTime() + OTP_POLICY.lockoutMinutes * 60_000).toISOString() };
}

export const otpMessage = (c: OtpCheck) => {
  if (c.ok) return "";
  const m = Math.ceil(c.retryInSeconds / 60);
  switch (c.reason) {
    case "cooldown": return `Please wait ${c.retryInSeconds}s before asking for a new code.`;
    case "hourly-limit": return `Too many codes requested. Try again in about ${m} minute${m === 1 ? "" : "s"}.`;
    case "locked": return `Too many wrong codes. Try again in about ${m} minute${m === 1 ? "" : "s"}.`;
    case "expired": return "This code has expired. Ask for a new one.";
    case "no-code": return "Ask for a code first.";
  }
};

/* ------------------------------------------------------------------ abandoned cart */

export type ReminderDecision = "off" | "checked-out" | "no-consent" | "already-sent" | "waiting" | "invalid-number" | "due";

/** Whether the 6-hour reminder should go out for a cart right now (backend runs the same check). */
export function reminderDecision(cart: AbandonedCart, settings: AbandonedCartSettings, now: Date, remindedCartIds: ReadonlySet<string>): ReminderDecision {
  if (!settings.enabled) return "off";
  if (cart.checkedOutAt) return "checked-out";
  if (cart.whatsappConsent !== true) return "no-consent";
  if (remindedCartIds.has(cart.id)) return "already-sent";
  if (new Date(cart.abandonedAt).getTime() + settings.delayHours * 3_600_000 > now.getTime()) return "waiting";
  if (!toWhatsAppDigits(cart.phone)) return "invalid-number";
  return "due";
}

export const REMINDER_LABEL: Record<ReminderDecision, string> = {
  off: "Automation off",
  "checked-out": "Stopped — checkout completed",
  "no-consent": "Not sent — no WhatsApp consent",
  "already-sent": "Already reminded (no duplicates)",
  waiting: "Waiting for the reminder time",
  "invalid-number": "Not sent — number masked or invalid",
  due: "Due — backend would send now",
};

/* ------------------------------------------------------------------ campaigns */

/** Who a marketing campaign may reach: active, opted in, with a usable number. */
export function campaignRecipients(customers: Customer[]) {
  const active = customers.filter((c) => c.status === "active");
  return {
    eligible: active.filter((c) => c.whatsappOptIn === "opted-in" && toWhatsAppDigits(c.phone)),
    optedOut: active.filter((c) => c.whatsappOptIn === "opted-out").length,
    notAsked: active.filter((c) => !c.whatsappOptIn).length,
    noNumber: active.filter((c) => c.whatsappOptIn === "opted-in" && !toWhatsAppDigits(c.phone)).length,
  };
}

/** Meta messaging limit tiers (unique customers per rolling 24 h for business-initiated messages). */
export const MESSAGING_TIERS = [250, 1_000, 10_000, 100_000] as const;

export function checkSendingLimit(recipients: number, dailyLimit: number | null) {
  if (dailyLimit == null) return { ok: false as const, message: "Your daily messaging limit is unknown until the backend reads it from Meta." };
  if (recipients > dailyLimit) return { ok: false as const, message: `${recipients} recipients is over today's limit of ${dailyLimit}. Split the campaign over several days.` };
  return { ok: true as const, message: `${recipients} of ${dailyLimit} daily conversations.` };
}

/* ------------------------------------------------------------------ delivery status (webhooks) */

export type DeliveryState = "accepted" | "sent" | "delivered" | "read" | "failed";
const RANK: Record<DeliveryState, number> = { accepted: 0, sent: 1, delivered: 2, read: 3, failed: 1 };

/** Apply a webhook status: older "sent" never overwrites "delivered"/"read"; "failed" only before delivery. */
export function mergeDeliveryState(current: DeliveryState, incoming: DeliveryState): DeliveryState {
  if (incoming === "failed") return current === "delivered" || current === "read" ? current : "failed";
  if (current === "failed") return incoming === "delivered" || incoming === "read" ? incoming : current;
  return RANK[incoming] > RANK[current] ? incoming : current;
}

/* ------------------------------------------------------------------ Meta error codes */

const META_ERRORS: Record<number, string> = {
  190: "Access token expired or invalid — the owner must issue a new token on the server.",
  10: "The token is missing a permission (needs whatsapp_business_messaging and whatsapp_business_management).",
  200: "The token is missing a permission (needs whatsapp_business_messaging and whatsapp_business_management).",
  100: "Meta rejected a parameter in the request.",
  4: "Too many API calls — Meta is rate limiting the app.",
  80007: "WhatsApp Business account rate limit reached.",
  130429: "Throughput limit reached — slow down sending.",
  131026: "Message could not be delivered (number not on WhatsApp or hasn't accepted terms).",
  131030: "Recipient isn't on the allowed test list.",
  131031: "The business account is locked or restricted by Meta.",
  131047: "More than 24 hours since the customer's last message — use an approved template.",
  131056: "Too many messages to this customer in a short time.",
  132000: "Template variable count doesn't match the approved template.",
  132001: "Template doesn't exist or isn't approved in this language.",
  133010: "The phone number isn't registered with the Cloud API.",
  368: "Temporarily blocked for policy violations.",
};

export const describeMetaError = (code: number, fallback = "Unknown WhatsApp error") => META_ERRORS[code] ?? `${fallback} (code ${code}).`;
export const KNOWN_META_ERRORS = Object.entries(META_ERRORS).map(([code, meaning]) => ({ code: Number(code), meaning }));

/* ------------------------------------------------------------------ chatbot routing */

export type ChatIntent = "order-tracking" | "shipping" | "refund" | "product" | "support" | "greeting" | "unknown";

const INTENT_WORDS: [ChatIntent, RegExp][] = [
  ["order-tracking", /\bBYA-?\d{3,}\b|\b(track|tracking|where is my|order status|my order)\b/i],
  ["refund", /\b(refund|return|exchange|cancel|money back|damaged)\b/i],
  ["shipping", /\b(ship|shipping|deliver|delivery|courier|dispatch|pincode)\b/i],
  ["support", /\b(human|agent|person|team|support|call me|talk|help)\b/i],
  ["product", /\b(product|serum|oil|mask|wash|cream|lotion|lipstick|kajal|sunscreen|price|buy|shop|skin|hair|acne|tan)\b/i],
  ["greeting", /^\s*(hi|hello|hey|namaste|hii+)\b/i],
];

export const detectIntent = (text: string): ChatIntent => INTENT_WORDS.find(([, re]) => re.test(text))?.[0] ?? "unknown";

const OPTION_HINT: Record<Exclude<ChatIntent, "greeting" | "unknown">, RegExp> = {
  "order-tracking": /track|order/i,
  shipping: /ship/i,
  refund: /refund|return/i,
  product: /product|browse|shop/i,
  support: /support|contact/i,
};

/** Reply to a typed message using the admin's menus; anything unclear goes to a person. */
export function replyToText(text: string, config: ChatbotConfig, storeUrl: string): { intent: ChatIntent; reply: string; handoff: boolean } {
  const intent = detectIntent(text);
  const entry = config.menus.find((m) => m.id === config.entryMenuId && m.enabled);
  const human = config.handoff
    ? `I'll pass this to our team — someone will reply here${config.supportHours ? ` (${config.supportHours})` : ""}.`
    : `Please contact our team at ${storeUrl}/contact.`;
  if (intent === "greeting") return { intent, reply: entry?.greeting ?? human, handoff: !entry };
  if (intent === "unknown") return { intent, reply: `Sorry, I didn't catch that. ${human}`, handoff: true };
  const orderId = intent === "order-tracking" ? /BYA-?\d{3,}/i.exec(text)?.[0]?.toUpperCase() : undefined;
  if (orderId) return { intent, reply: `Looking up ${orderId}… (the backend checks it belongs to this WhatsApp number before sharing any details).`, handoff: false };
  const option = entry?.options.find((o) => OPTION_HINT[intent].test(o.label));
  if (!option) return { intent, reply: human, handoff: true };
  return { intent, reply: option.response.replace(/\{store_url\}/g, storeUrl), handoff: intent === "support" && config.handoff };
}
