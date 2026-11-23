// Admin views over the WhatsApp tables: message log, Meta errors, consent records, the support
// inbox and the integration checks. Phone numbers are masked unless the admin may view customers.
import { createHmac } from "node:crypto";

import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

import type { Config } from "../config.js";
import { HttpError, badRequest, notFound } from "../errors.js";
import { isIndianMobile, normalizeIndianPhone } from "../lib/india.js";
import { CONSENT, PURPOSES, classifyMetaError, maskPhone, verifyMetaSignature, type OrderPurpose } from "../lib/whatsapp.js";
import { logActivity, type Actor } from "./activity.js";
import type { WhatsAppService } from "./whatsappService.js";

export const messageFilterSchema = z.object({
  kind: z.enum(["otp", "order", "cart", "campaign", "chatbot", "support", "test", "inbound"]).optional(),
  state: z.enum(["QUEUED", "ACCEPTED", "SENT", "DELIVERED", "READ", "FAILED", "SKIPPED", "RECEIVED"]).optional(),
  phone: z.string().trim().max(20).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});
export const consentInputSchema = z.object({
  phone: z.string().max(20),
  purpose: z.enum([CONSENT.orderUpdates, CONSENT.marketing]),
  status: z.enum(["OPTED_IN", "OPTED_OUT"]),
  /** where the customer told us (phone call, email …) — admins record, never invent, consent */
  note: z.string().trim().min(3, "Say how the customer told you").max(50),
});
export const replySchema = z.object({ text: z.string().trim().min(1).max(2000) });
export const testSchema = z.object({ check: z.string().max(40), recipient: z.string().max(20) });

const waOf = (input: string) => {
  const d = normalizeIndianPhone(input);
  if (!isIndianMobile(d)) throw badRequest("Enter a valid 10-digit Indian mobile number.");
  return `91${d}`;
};

export function createWhatsAppAdmin(deps: { prisma: PrismaClient; config: Config; wa: WhatsAppService }) {
  const { prisma, config, wa } = deps;

  const messageView = (m: Prisma.WhatsAppMessageGetPayload<object>, showPhones: boolean) => ({
    id: m.id, direction: m.direction, kind: m.kind, purpose: m.purpose, label: m.purpose && m.purpose in PURPOSES ? PURPOSES[m.purpose as keyof typeof PURPOSES].label : null,
    to: showPhones ? `+${m.phone}` : maskPhone(m.phone), templateName: m.templateName, state: m.state, attempts: m.attempts,
    nextAttemptAt: m.nextAttemptAt?.toISOString() ?? null, errorCode: m.errorCode, error: m.errorTitle,
    // OTP and template variables are never shown; free-form text only to admins allowed to see customers
    text: m.kind === "otp" ? null : showPhones ? m.body : m.body ? "(hidden)" : null,
    orderId: m.orderId, campaignId: m.campaignId, needsHuman: m.needsHuman, handledAt: m.handledAt?.toISOString() ?? null,
    at: m.createdAt.toISOString(), acceptedAt: m.acceptedAt?.toISOString() ?? null, sentAt: m.sentAt?.toISOString() ?? null,
    deliveredAt: m.deliveredAt?.toISOString() ?? null, readAt: m.readAt?.toISOString() ?? null, failedAt: m.failedAt?.toISOString() ?? null,
  });

  return {
    async messages(f: z.infer<typeof messageFilterSchema>, showPhones: boolean) {
      const phone = f.phone ? (() => { const d = normalizeIndianPhone(f.phone!); return isIndianMobile(d) ? `91${d}` : null; })() : null;
      if (f.phone && !phone) throw badRequest("Enter a valid 10-digit mobile number to filter by.");
      const where: Prisma.WhatsAppMessageWhereInput = { ...(f.kind ? { kind: f.kind } : {}), ...(f.state ? { state: f.state } : {}), ...(phone ? { phone } : {}) };
      const since = new Date(Date.now() - 30 * 86_400_000);
      const [rows, total, counts] = await Promise.all([
        prisma.whatsAppMessage.findMany({ where, orderBy: { createdAt: "desc" }, skip: (f.page - 1) * 50, take: 50 }),
        prisma.whatsAppMessage.count({ where }),
        prisma.whatsAppMessage.groupBy({ by: ["state"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
      ]);
      return { messages: rows.map((m) => messageView(m, showPhones)), total, page: f.page, last30Days: Object.fromEntries(counts.map((c) => [c.state, c._count._all])) };
    },
    async errors() {
      const rows = await prisma.whatsAppApiError.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
      return { errors: rows.map((e) => ({ id: String(e.id), at: e.createdAt.toISOString(), operation: e.operation, httpStatus: e.httpStatus, code: e.code, subcode: e.subcode, message: e.title, detail: e.detail, traceId: e.traceId })) };
    },
    async consents(phoneInput: string | undefined, showPhones: boolean) {
      const where = phoneInput ? { phone: waOf(phoneInput) } : {};
      const rows = await prisma.whatsAppConsent.findMany({ where, orderBy: [{ recordedAt: "desc" }, { id: "desc" }], take: 200 });
      const [optIn, optOut] = await Promise.all(([CONSENT.marketing, CONSENT.orderUpdates] as const).map(async (purpose) => {
        const all = await prisma.whatsAppConsent.findMany({ where: { purpose }, orderBy: [{ recordedAt: "asc" }, { id: "asc" }], select: { phone: true, status: true } });
        const m = new Map<string, string>(); for (const r of all) m.set(r.phone, r.status);
        return { optedIn: [...m.values()].filter((s) => s === "OPTED_IN").length, optedOut: [...m.values()].filter((s) => s === "OPTED_OUT").length };
      }));
      return {
        summary: { marketing: optIn, orderUpdates: optOut },
        history: rows.map((r) => ({ id: r.id, phone: showPhones ? `+${r.phone}` : maskPhone(r.phone), purpose: r.purpose, status: r.status, source: r.source, at: r.recordedAt.toISOString() })),
      };
    },
    async setConsent(input: z.infer<typeof consentInputSchema>, actor: Actor) {
      const phone = waOf(input.phone);
      const changed = await wa.recordConsent(prisma, { phone, purpose: input.purpose, status: input.status, source: `admin: ${input.note}` });
      if (changed) await logActivity(prisma, actor, { action: "whatsapp.consent", entityType: "whatsapp_consent", summary: `${maskPhone(phone)} ${input.purpose} → ${input.status} (${input.note})` });
      if (input.status === "OPTED_OUT") {
        const kinds = input.purpose === CONSENT.marketing ? ["cart", "campaign"] : ["order"];
        await prisma.whatsAppMessage.updateMany({ where: { phone, state: "QUEUED", kind: { in: kinds } }, data: { state: "SKIPPED", nextAttemptAt: null, errorTitle: "Customer opted out before it was sent." } });
      }
      return { changed };
    },
    async inbox(showPhones: boolean) {
      const open = await prisma.whatsAppMessage.findMany({ where: { direction: "INBOUND", needsHuman: true, handledAt: null }, orderBy: { createdAt: "asc" }, take: 100 });
      const phones = [...new Set(open.map((m) => m.phone))];
      const threads = await Promise.all(phones.map(async (phone) => {
        const msgs = await prisma.whatsAppMessage.findMany({ where: { phone, kind: { in: ["inbound", "chatbot", "support"] } }, orderBy: { createdAt: "desc" }, take: 12 });
        const lastIn = msgs.find((m) => m.direction === "INBOUND");
        return {
          phone: showPhones ? `+${phone}` : maskPhone(phone), key: open.find((m) => m.phone === phone)!.id,
          canReply: !!lastIn && Date.now() - lastIn.createdAt.getTime() < 24 * 3_600_000,
          messages: msgs.reverse().map((m) => messageView(m, showPhones)),
        };
      }));
      return { threads };
    },
    async resolve(id: string, actor: Actor) {
      const m = await prisma.whatsAppMessage.findUnique({ where: { id } });
      if (!m || m.direction !== "INBOUND") throw notFound("Message not found.");
      await prisma.whatsAppMessage.updateMany({ where: { phone: m.phone, direction: "INBOUND", needsHuman: true, handledAt: null }, data: { handledAt: new Date(), handledById: actor.userId } });
      return { resolved: true };
    },
    async reply(id: string, text: string, actor: Actor) {
      const m = await prisma.whatsAppMessage.findUnique({ where: { id } });
      if (!m || m.direction !== "INBOUND") throw notFound("Message not found.");
      const out = await wa.sendNow({ kind: "support", phone: m.phone, customerId: m.customerId, text });
      if (!out.ok) throw new HttpError(409, "not_sent", out.reason);
      await prisma.whatsAppMessage.updateMany({ where: { phone: m.phone, direction: "INBOUND", needsHuman: true, handledAt: null }, data: { handledAt: new Date(), handledById: actor.userId } });
      await logActivity(prisma, actor, { action: "whatsapp.reply", entityType: "whatsapp_message", entityId: out.messageId, summary: `Replied on WhatsApp to ${maskPhone(m.phone)}` });
      return { sent: true, messageId: out.messageId };
    },
    async orderMessages(orderId: string) {
      const rows = await prisma.whatsAppMessage.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
      return { messages: rows.map((m) => messageView(m, true)) };
    },
    /** Re-queue a FAILED order update (same row, same dedupe key, so never a second copy). */
    async retryOrderMessage(orderId: string, purpose: OrderPurpose, actor: Actor) {
      const row = await prisma.whatsAppMessage.findUnique({ where: { dedupeKey: `order:${orderId}:${purpose}` } });
      if (!row) throw notFound("No WhatsApp update of that kind exists for this order.");
      if (row.state !== "FAILED") throw new HttpError(409, "not_failed", "Only a failed update can be sent again.");
      await prisma.whatsAppMessage.updateMany({ where: { id: row.id, state: "FAILED" }, data: { state: "QUEUED", nextAttemptAt: new Date(), attempts: 0, errorCode: null, errorTitle: null } });
      await logActivity(prisma, actor, { action: "whatsapp.retry", entityType: "order", entityId: orderId, summary: `Retry of WhatsApp “${PURPOSES[purpose].label}” requested` });
      wa.kick();
      return { queued: true };
    },
    /**
     * Integration checks for the admin screen. Each says exactly what was checked; the one real send
     * goes only to a number listed in WHATSAPP_TEST_RECIPIENTS.
     */
    async runCheck(key: string, recipientInput: string) {
      const at = new Date().toISOString();
      const done = (passed: boolean, detail: string) => ({ key, passed, detail, at });
      if (!config.whatsapp) return done(false, "WhatsApp isn't configured on the server.");
      const status = await wa.status(key === "auth");
      const c = (k: string) => status.checks.find((x) => x.key === k);
      switch (key) {
        case "auth": return done(!!c("auth")?.ok && status.state !== "token-invalid", c("auth")?.detail ?? "Not checked.");
        case "phone": return done(!!c("waba")?.ok, c("waba")?.detail ?? "Not checked.");
        case "templates": return done(!!c("templates")?.ok, c("templates")?.detail ?? "Not checked.");
        case "test-message": {
          const to = waOf(recipientInput);
          if (!config.whatsapp.testRecipients.includes(to)) return done(false, "This number isn't in WHATSAPP_TEST_RECIPIENTS on the server, so nothing was sent.");
          const recent = await prisma.whatsAppMessage.findFirst({ where: { kind: "test", phone: to, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } } });
          if (recent) return done(recent.state !== "FAILED", `A test was already sent in the last 10 minutes (${recent.state.toLowerCase()}${recent.errorTitle ? `: ${recent.errorTitle}` : ""}).`);
          const out = await wa.sendNow({ kind: "test", purpose: "test", phone: to, values: { body: [] } });
          return done(out.ok, out.ok ? `Meta accepted the test message (id ${out.waMessageId}). Delivery ticks arrive by webhook.` : out.reason);
        }
        case "webhook-verify": return done(!!status.webhook.lastVerifiedAt, status.webhook.lastVerifiedAt ? `Meta's handshake succeeded at ${status.webhook.lastVerifiedAt}.` : "No handshake yet — press “Verify and save” in Meta's webhook settings.");
        case "webhook-signature": {
          const body = Buffer.from(JSON.stringify({ object: "whatsapp_business_account", entry: [] }));
          const good = `sha256=${createHmac("sha256", config.whatsapp.appSecret).update(body).digest("hex")}`;
          const ok = verifyMetaSignature(body, good, config.whatsapp.appSecret) && !verifyMetaSignature(Buffer.concat([body, Buffer.from(" ")]), good, config.whatsapp.appSecret);
          return done(ok, ok ? "Checked on the server: a correct signature is accepted and a tampered body is rejected. (Real deliveries are checked the same way.)" : "Signature check failed its self-test.");
        }
        case "status": {
          const n = await prisma.whatsAppMessage.count({ where: { direction: "OUTBOUND", OR: [{ sentAt: { not: null } }, { deliveredAt: { not: null } }, { readAt: { not: null } }, { failedAt: { not: null }, waMessageId: { not: null } }] } });
          return done(n > 0, n > 0 ? `${n} message(s) have delivery statuses stored from Meta's webhook.` : "No delivery status has arrived yet. Send the test message, then run this again.");
        }
        case "errors": {
          const last = await prisma.whatsAppApiError.findFirst({ orderBy: { createdAt: "desc" } });
          return done(true, last ? `Errors are recorded; latest: ${last.title}` : "Error log is working; no Meta errors recorded.");
        }
        case "token-expired": {
          const ok = classifyMetaError(401, 190) === "token";
          const h = await wa.health();
          return done(ok, h.tokenInvalidAt ? `Meta rejected the token at ${h.tokenInvalidAt}: sending is paused until it is replaced.` : "Checked on the server: a Meta 190 error pauses sending and is shown here. The current token has not been rejected.");
        }
        case "duplicates": {
          const key = `selftest:${Date.now()}:${Math.random().toString(36).slice(2)}`;
          await prisma.whatsAppWebhookEvent.create({ data: { dedupeKey: key, field: "selftest", payload: {}, processedAt: new Date(), outcome: "ignored" } });
          let duplicateRejected = false;
          try { await prisma.whatsAppWebhookEvent.create({ data: { dedupeKey: key, field: "selftest", payload: {}, processedAt: new Date(), outcome: "ignored" } }); } catch { duplicateRejected = true; }
          await prisma.whatsAppWebhookEvent.deleteMany({ where: { dedupeKey: key } });
          return done(duplicateRejected, duplicateRejected ? "Checked in the database: the same webhook event can only be stored once." : "Duplicate event was stored twice — check the database index.");
        }
        default: throw badRequest("Unknown check.");
      }
    },
  };
}
export type WhatsAppAdmin = ReturnType<typeof createWhatsAppAdmin>;
