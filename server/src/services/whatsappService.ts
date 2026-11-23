// WhatsApp Business Cloud API core: settings, template lookup, the persistent send queue, delivery
// statuses from webhooks, consent records and connection diagnostics. Every send goes through a
// WhatsAppMessage row whose unique dedupeKey stops the same business event from sending twice.
import { createHash, randomUUID } from "node:crypto";

import { Prisma, type PrismaClient, type WhatsAppMessage, type WhatsAppWebhookEvent } from "@prisma/client";
import { z } from "zod";

import type { Config } from "../config.js";
import { HttpError } from "../errors.js";
import type { Logger } from "../logger.js";
import {
  BACKOFF_MINUTES, CONSENT, MAX_SEND_ATTEMPTS, PURPOSES, PURPOSE_KEYS, backoffMs, buildComponents, describeMetaError, localFromWa, mergeDeliveryState,
  metaStatusToState, safeEqual, templateShape, tierLimit, verifyMetaSignature,
  type ConsentPurpose, type DeliveryState, type MetaTemplate, type Purpose, type TemplateValues,
} from "../lib/whatsapp.js";
import { MetaApiError, createGraphClient, type GraphClient } from "./whatsappGraph.js";

type Tx = Prisma.TransactionClient;
type Db = PrismaClient | Tx;

/* ───────────────────────────── admin-editable settings (StoreSetting) ───────────────────────────── */

const templateRef = z.object({ name: z.string().trim().regex(/^[a-z0-9_]{1,100}$/, "Template names use lowercase letters, numbers and _"), language: z.string().trim().regex(/^[a-z]{2,3}(_[A-Z]{2})?$/, "Language code like en or en_US") });
export const templateMapSchema = z.record(z.enum(PURPOSE_KEYS as [Purpose, ...Purpose[]]), templateRef);
export type TemplateMap = Record<Purpose, { name: string; language: string }>;
const DEFAULT_MAP = Object.fromEntries(PURPOSE_KEYS.map((k) => [k, { name: PURPOSES[k].defaultName, language: k === "test" ? "en_US" : "en" }])) as TemplateMap;

export const automationSchema = z.object({
  otp: z.boolean(),
  orderUpdates: z.boolean(),
  abandonedCart: z.boolean(),
  chatbot: z.boolean(),
  /** business-initiated marketing messages (campaigns + bag reminders) per rolling 24 h */
  marketingDailyLimit: z.number().int().min(0).max(100_000),
});
export type Automations = z.infer<typeof automationSchema>;
const DEFAULT_AUTOMATIONS: Automations = { otp: true, orderUpdates: true, abandonedCart: true, chatbot: true, marketingDailyLimit: 250 };

interface Health {
  tokenInvalidAt?: string | null;
  tokenError?: string | null;
  accountBlocked?: { event: string; at: string } | null;
  quality?: { event: string; currentLimit: string | null; at: string } | null;
  lastWebhookAt?: string | null;
  lastVerifiedAt?: string | null;
  lastSignatureFailureAt?: string | null;
  templateEvents?: { name: string; event: string; reason: string | null; at: string }[];
}

const KEYS = { map: "whatsapp.templates", automations: "whatsapp.automations", health: "whatsapp.health" } as const;

/* ───────────────────────────── message intents ───────────────────────────── */

export interface QueueInput {
  kind: "order" | "cart" | "campaign" | "chatbot" | "support" | "test" | "otp";
  purpose?: Purpose | null;
  dedupeKey?: string | null;
  phone: string;
  customerId?: string | null;
  orderId?: string | null;
  campaignId?: string | null;
  /** template messages */
  values?: TemplateValues;
  templateName?: string;
  language?: string;
  /** free-form text (inside the 24-hour customer-service window) */
  text?: string;
  /** when the worker may send it (default now) */
  notBefore?: Date;
  /** recorded but not sent, with the reason shown to admins */
  skipReason?: string;
}

export type SendOutcome = { ok: true; messageId: string; waMessageId: string } | { ok: false; messageId: string; reason: string; retrying: boolean };

const SEND_KINDS_NEEDING_CONSENT: Record<string, ConsentPurpose> = { order: CONSENT.orderUpdates, cart: CONSENT.marketing, campaign: CONSENT.marketing };
const MARKETING_KINDS = ["cart", "campaign"];
const DELIVERED_STATES = ["ACCEPTED", "SENT", "DELIVERED", "READ"] as const;
const BLOCK_EVENTS = new Set(["DISABLED_UPDATE", "PARTNER_REMOVED", "PARTNER_APP_UNINSTALLED", "ACCOUNT_DELETED", "ACCOUNT_OFFBOARDED", "ACCOUNT_VIOLATION", "ACCOUNT_RESTRICTION"]);
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export interface InboundMessage { messageId: string; waMessageId: string; phone: string; text: string; type: string; profileName: string | null; customerId: string | null; at: Date }
export type InboundHandler = (m: InboundMessage) => Promise<void>;

export function createWhatsAppService(deps: { prisma: PrismaClient; config: Config; logger: Logger; graph?: GraphClient | null; now?: () => Date }) {
  const { prisma, config, logger } = deps;
  const wa = config.whatsapp;
  const graph: GraphClient | null = deps.graph !== undefined ? deps.graph : wa ? createGraphClient(wa) : null;
  const now = deps.now ?? (() => new Date());
  let inboundHandler: InboundHandler | null = null;
  let kicker: (() => void) | null = null;
  let templateCache: { at: number; list: MetaTemplate[] } | null = null;
  let statusCache: { at: number; value: Awaited<ReturnType<typeof computeStatus>> } | null = null;

  /* ───────── settings ───────── */

  async function readSetting<T>(key: string, fallback: T): Promise<T> {
    const row = await prisma.storeSetting.findUnique({ where: { key } });
    return row ? ({ ...fallback, ...(row.value as object) } as T) : fallback;
  }
  const writeSetting = (key: string, value: unknown) =>
    prisma.storeSetting.upsert({ where: { key }, create: { key, value: value as Prisma.InputJsonValue }, update: { value: value as Prisma.InputJsonValue } });

  const templateMap = () => readSetting<TemplateMap>(KEYS.map, DEFAULT_MAP);
  const automations = () => readSetting<Automations>(KEYS.automations, DEFAULT_AUTOMATIONS);
  const health = () => readSetting<Health>(KEYS.health, {});
  async function patchHealth(p: Partial<Health>) {
    const h = await health();
    await writeSetting(KEYS.health, { ...h, ...p });
  }

  /* ───────── API errors ───────── */

  async function recordApiError(e: MetaApiError) {
    try {
      await prisma.whatsAppApiError.create({ data: { operation: e.operation.slice(0, 60), httpStatus: e.httpStatus, code: e.code, subcode: e.subcode, title: e.reason.slice(0, 300), detail: e.detail, traceId: e.traceId } });
      if (e.kind === "token") await patchHealth({ tokenInvalidAt: now().toISOString(), tokenError: e.reason });
    } catch (err) {
      logger.error("whatsapp error log failed", { error: err instanceof Error ? err.message : String(err) });
    }
    logger.warn("whatsapp api error", { operation: e.operation, httpStatus: e.httpStatus, code: e.code, subcode: e.subcode, traceId: e.traceId });
  }

  /* ───────── templates ───────── */

  async function templates(force = false): Promise<MetaTemplate[]> {
    if (!graph || !wa) return [];
    if (!force && templateCache && Date.now() - templateCache.at < 5 * 60_000) return templateCache.list;
    const list: MetaTemplate[] = [];
    let after: string | undefined;
    for (let page = 0; page < 10; page++) {
      try {
        const res = await graph.get<{ data?: MetaTemplate[]; paging?: { cursors?: { after?: string }; next?: string } }>("templates.list", `${wa.wabaId}/message_templates`, { fields: "id,name,status,category,language,components", limit: "100", ...(after ? { after } : {}) });
        list.push(...(res.data ?? []));
        after = res.paging?.next ? res.paging.cursors?.after : undefined;
        if (!after) break;
      } catch (e) {
        if (e instanceof MetaApiError) await recordApiError(e);
        throw e;
      }
    }
    templateCache = { at: Date.now(), list };
    return list;
  }

  type Resolved = { ok: true; template: MetaTemplate } | { ok: false; reason: string };
  async function resolveTemplate(name: string, language: string, category: string | null): Promise<Resolved> {
    let list: MetaTemplate[];
    try { list = await templates(); } catch (e) { return { ok: false, reason: e instanceof MetaApiError ? `Couldn't read templates from Meta: ${e.reason}` : "Couldn't read templates from Meta." }; }
    const same = list.filter((t) => t.name === name);
    const t = same.find((x) => x.language === language);
    if (!t) return { ok: false, reason: same.length ? `Template “${name}” exists in ${same.map((x) => x.language).join(", ")} but not in ${language}.` : `Template “${name}” doesn't exist in WhatsApp Manager yet.` };
    if (t.status !== "APPROVED") return { ok: false, reason: `Template “${name}” is ${t.status.toLowerCase()} at Meta, not approved.` };
    if (category && t.category.toUpperCase() !== category) return { ok: false, reason: `Template “${name}” is in the ${t.category} category; this message needs a ${category} template.` };
    return { ok: true, template: t };
  }

  /** Whether a purpose can be sent right now (template approved, right shape). */
  async function purposeReady(purpose: Purpose): Promise<{ ok: true; name: string; language: string } | { ok: false; reason: string }> {
    if (!wa) return { ok: false, reason: "WhatsApp isn't configured on the server." };
    const ref = (await templateMap())[purpose];
    const r = await resolveTemplate(ref.name, ref.language, purpose === "test" ? null : PURPOSES[purpose].category);
    if (!r.ok) return r;
    const shape = templateShape(r.template);
    const need = PURPOSES[purpose].vars.length;
    if (purpose === "otp") {
      if (shape.bodyVars !== 1) return { ok: false, reason: "The sign-in template must have exactly one variable (the code)." };
    } else if (purpose === "abandoned_cart") {
      // the bag link may be in the body ({{2}}) or a link button
      if (!(shape.bodyVars === 2 || (shape.bodyVars === 1 && shape.urlButtonIndex !== null))) return { ok: false, reason: "The bag reminder template needs the name plus the bag link (as {{2}} or as a link button)." };
    } else if (shape.bodyVars !== need) {
      return { ok: false, reason: `Template “${ref.name}” has ${shape.bodyVars} variable(s); it needs ${need} (${PURPOSES[purpose].vars.join(", ")}).` };
    }
    if (shape.unsupportedHeader) return { ok: false, reason: `Template “${ref.name}” has a header with a variable or media, which the store doesn't fill.` };
    return { ok: true, name: ref.name, language: ref.language };
  }

  /* ───────── consent ───────── */

  async function latestConsent(db: Db, phone: string, purpose: ConsentPurpose) {
    const row = await db.whatsAppConsent.findFirst({ where: { phone, purpose }, orderBy: [{ recordedAt: "desc" }, { id: "desc" }] });
    return row?.status ?? null;
  }
  async function recordConsent(db: Db, input: { phone: string; purpose: ConsentPurpose; status: "OPTED_IN" | "OPTED_OUT"; source: string; customerId?: string | null }) {
    // Opting out of offers (STOP, account, admin, Meta) always ends a bag-page reminder choice too.
    if (input.purpose === CONSENT.marketing && input.status === "OPTED_OUT" && (await latestConsent(db, input.phone, CONSENT.cartReminder)) === "OPTED_IN") {
      await db.whatsAppConsent.create({ data: { phone: input.phone, purpose: CONSENT.cartReminder, status: "OPTED_OUT", source: input.source.slice(0, 60), customerId: input.customerId ?? null } });
    }
    const current = await latestConsent(db, input.phone, input.purpose);
    if (current === input.status) return false;
    await db.whatsAppConsent.create({ data: { phone: input.phone, purpose: input.purpose, status: input.status, source: input.source.slice(0, 60), customerId: input.customerId ?? null } });
    return true;
  }
  /** A bag reminder may go out when the newest offers-or-reminder choice for this number is a yes. */
  async function cartReminderConsent(db: Db, phone: string) {
    const row = await db.whatsAppConsent.findFirst({ where: { phone, purpose: { in: [CONSENT.marketing, CONSENT.cartReminder] } }, orderBy: [{ recordedAt: "desc" }, { id: "desc" }] });
    return row?.status ?? null;
  }

  /* ───────── queue ───────── */

  /** Adds a message to the persistent queue. A repeated dedupeKey is ignored (returns false). */
  async function enqueue(db: Db, m: QueueInput): Promise<boolean> {
    if (!wa) return false; // nothing can be sent; don't pile up rows that would look pending
    const at = m.notBefore ?? now();
    const res = await db.whatsAppMessage.createMany({
      skipDuplicates: true,
      data: [{
        direction: "OUTBOUND", kind: m.kind, purpose: m.purpose ?? null, dedupeKey: m.dedupeKey ?? null, phone: m.phone,
        customerId: m.customerId ?? null, orderId: m.orderId ?? null, campaignId: m.campaignId ?? null,
        templateName: m.templateName ?? null, language: m.language ?? null,
        params: m.values ? (m.values as unknown as Prisma.InputJsonValue) : Prisma.DbNull, body: m.text ?? null,
        state: m.skipReason ? "SKIPPED" : "QUEUED", nextAttemptAt: m.skipReason ? null : at, errorTitle: m.skipReason?.slice(0, 300) ?? null,
      }],
    });
    return res.count === 1;
  }

  async function finish(id: string, data: Prisma.WhatsAppMessageUpdateInput) {
    await prisma.whatsAppMessage.update({ where: { id }, data });
  }

  /**
   * One delivery attempt. `retry` = queue semantics (transient errors wait and try again);
   * direct sends (sign-in codes) never retry because the code would be stale.
   */
  async function attempt(row: WhatsAppMessage, opts: { retry: boolean; values?: TemplateValues }): Promise<SendOutcome> {
    const fail = async (reason: string, data: Prisma.WhatsAppMessageUpdateInput = {}): Promise<SendOutcome> => {
      await finish(row.id, { state: "FAILED", failedAt: now(), nextAttemptAt: null, errorTitle: reason.slice(0, 300), ...data });
      return { ok: false, messageId: row.id, reason, retrying: false };
    };
    const skip = async (reason: string): Promise<SendOutcome> => {
      await finish(row.id, { state: "SKIPPED", nextAttemptAt: null, errorTitle: reason.slice(0, 300) });
      return { ok: false, messageId: row.id, reason, retrying: false };
    };
    const later = async (reason: string, ms: number, countAttempt: boolean): Promise<SendOutcome> => {
      await finish(row.id, { state: "QUEUED", nextAttemptAt: new Date(now().getTime() + ms), errorTitle: reason.slice(0, 300), ...(countAttempt ? { attempts: { increment: 1 } } : {}) });
      return { ok: false, messageId: row.id, reason, retrying: true };
    };
    if (!graph || !wa) return fail("WhatsApp isn't configured on the server.");

    const h = await health();
    if (h.accountBlocked) return opts.retry ? later(`Sending paused: Meta reported ${h.accountBlocked.event} for the WhatsApp account.`, 30 * 60_000, false) : fail(`Meta reported ${h.accountBlocked.event} for the WhatsApp account.`);
    if (h.tokenInvalidAt) return opts.retry ? later("Sending paused: the access token was rejected by Meta. Update WHATSAPP_ACCESS_TOKEN, then re-check the connection.", 10 * 60_000, false) : fail("The WhatsApp access token was rejected by Meta.");
    // queued too long (e.g. the token was broken for days): don't send stale order news
    if (opts.retry && now().getTime() - row.createdAt.getTime() > 3 * 86_400_000) return skip("Not sent: waited in the queue for more than 3 days.");

    const consentPurpose = SEND_KINDS_NEEDING_CONSENT[row.kind];
    if (consentPurpose && (await (row.kind === "cart" ? cartReminderConsent(prisma, row.phone) : latestConsent(prisma, row.phone, consentPurpose))) !== "OPTED_IN") {
      return skip(consentPurpose === CONSENT.marketing ? "Not sent: the customer hasn't agreed to WhatsApp offers or has opted out." : "Not sent: the customer hasn't agreed to WhatsApp order updates or has opted out.");
    }
    if (MARKETING_KINDS.includes(row.kind)) {
      const dayAgo = new Date(now().getTime() - 86_400_000);
      const recent = await prisma.whatsAppMessage.count({ where: { phone: row.phone, kind: { in: MARKETING_KINDS }, state: { in: [...DELIVERED_STATES] }, acceptedAt: { gte: dayAgo }, id: { not: row.id } } });
      if (recent > 0) return skip("Not sent: this customer already received a marketing message in the last 24 hours.");
      const a = await automations();
      const tier = tierLimit((statusCache?.value.phone?.messagingLimitTier as string | undefined) ?? null);
      const cap = Math.min(a.marketingDailyLimit, tier ?? Number.POSITIVE_INFINITY);
      const used = (await prisma.whatsAppMessage.groupBy({ by: ["phone"], where: { kind: { in: MARKETING_KINDS }, state: { in: [...DELIVERED_STATES] }, acceptedAt: { gte: dayAgo } } })).length;
      if (used >= cap) {
        if (!opts.retry) return fail(`Daily marketing limit of ${cap} reached.`);
        return later(`Waiting: today's marketing limit of ${cap} messages is used up.`, 60 * 60_000, false);
      }
    }

    let payload: Record<string, unknown>;
    let templateName: string | null = null, language: string | null = null;
    if (row.body !== null && !row.purpose && !row.templateName) {
      // free-form text: allowed only inside 24 h of the customer's last message
      const lastIn = await prisma.whatsAppMessage.findFirst({ where: { phone: row.phone, direction: "INBOUND" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
      if (!lastIn || now().getTime() - lastIn.createdAt.getTime() > 24 * 3_600_000) return fail(describeMetaError(131047));
      payload = { messaging_product: "whatsapp", recipient_type: "individual", to: row.phone, type: "text", text: { preview_url: true, body: row.body.slice(0, 4096) } };
    } else {
      let ref: { name: string; language: string; category: string | null };
      if (row.templateName && row.language) ref = { name: row.templateName, language: row.language, category: row.kind === "campaign" ? "MARKETING" : PURPOSES[(row.purpose ?? "test") as Purpose].category };
      else if (row.purpose && row.purpose in PURPOSES) { const m = (await templateMap())[row.purpose as Purpose]; ref = { ...m, category: row.purpose === "test" ? null : PURPOSES[row.purpose as Purpose].category }; }
      else return fail("No template was chosen for this message.");
      const r = await resolveTemplate(ref.name, ref.language, ref.category);
      if (!r.ok) return fail(`Not sent: ${r.reason}`);
      const values = opts.values ?? (row.params as unknown as TemplateValues | null) ?? { body: [] };
      const shape = templateShape(r.template);
      // bag reminder: when the template carries the link in a button, the body has only the name
      const fitted: TemplateValues = row.purpose === "abandoned_cart" && shape.urlButtonIndex !== null && shape.bodyVars === 1 ? { body: values.body.slice(0, 1), ...(values.button ? { button: values.button } : {}) } : values;
      const built = buildComponents(shape, fitted);
      if (!built.ok) return fail(`Not sent: ${built.reason}`);
      templateName = ref.name; language = ref.language;
      payload = { messaging_product: "whatsapp", recipient_type: "individual", to: row.phone, type: "template", template: { name: ref.name, language: { code: ref.language }, ...(built.components.length ? { components: built.components } : {}) } };
    }

    try {
      const res = await graph.post<{ messages?: { id: string; message_status?: string }[] }>("messages.send", `${wa.phoneNumberId}/messages`, payload);
      const id = res.messages?.[0]?.id;
      if (!id) return fail("Meta accepted the request but returned no message id.", { attempts: { increment: 1 } });
      await finish(row.id, { state: "ACCEPTED", waMessageId: id, acceptedAt: now(), nextAttemptAt: null, errorCode: null, errorTitle: null, attempts: { increment: 1 }, templateName, language });
      await applyPendingStatuses(id);
      return { ok: true, messageId: row.id, waMessageId: id };
    } catch (e) {
      if (!(e instanceof MetaApiError)) throw e;
      await recordApiError(e);
      const attempts = row.attempts + 1;
      if (e.ambiguous) return fail("Meta didn't answer in time — the message may or may not have been sent, so it is not resent automatically (to avoid a duplicate).", { attempts: { increment: 1 } });
      if (opts.retry && (e.kind === "token" || e.kind === "transient") && attempts < MAX_SEND_ATTEMPTS) {
        return later(`Will retry: ${e.reason}`, e.kind === "token" ? 10 * 60_000 : backoffMs(attempts), true);
      }
      return fail(e.reason, { errorCode: e.code, attempts: { increment: 1 }, errors: { code: e.code, subcode: e.subcode, detail: e.detail, traceId: e.traceId } as Prisma.InputJsonValue });
    }
  }

  /** Sends queued messages that are due. Each row is claimed first, so two workers never send it twice. */
  async function processQueue(limit = 25) {
    if (!graph) return { attempted: 0 };
    const t = now();
    const due = await prisma.whatsAppMessage.findMany({ where: { state: "QUEUED", nextAttemptAt: { lte: t } }, orderBy: { nextAttemptAt: "asc" }, take: limit });
    let attempted = 0;
    for (const row of due) {
      const claim = await prisma.whatsAppMessage.updateMany({ where: { id: row.id, state: "QUEUED", nextAttemptAt: row.nextAttemptAt }, data: { nextAttemptAt: new Date(t.getTime() + 5 * 60_000) } });
      if (claim.count !== 1) continue;
      attempted++;
      try { await attempt(row, { retry: true }); }
      catch (e) { logger.error("whatsapp send crashed", { id: row.id, error: e instanceof Error ? e.message : String(e) }); }
    }
    return { attempted };
  }

  /** Immediate send (sign-in codes, admin tests). Recorded like every other message. */
  async function sendNow(m: QueueInput & { storedValues?: TemplateValues }, values?: TemplateValues): Promise<SendOutcome> {
    if (!wa) throw new HttpError(503, "whatsapp_not_configured", "WhatsApp isn't connected on the server yet.");
    const row = await prisma.whatsAppMessage.create({
      data: {
        direction: "OUTBOUND", kind: m.kind, purpose: m.purpose ?? null, dedupeKey: m.dedupeKey ?? null, phone: m.phone,
        customerId: m.customerId ?? null, templateName: m.templateName ?? null, language: m.language ?? null,
        params: (m.storedValues ?? m.values) ? ((m.storedValues ?? m.values) as unknown as Prisma.InputJsonValue) : Prisma.DbNull, body: m.text ?? null, state: "QUEUED", nextAttemptAt: null,
      },
    });
    return attempt(row, { retry: false, ...(values ? { values } : m.values ? { values: m.values } : {}) });
  }

  /* ───────── webhooks ───────── */

  function explode(body: unknown): { key: string; field: string; payload: unknown }[] {
    const out: { key: string; field: string; payload: unknown }[] = [];
    const entries = (body as { entry?: { id?: string; changes?: { field?: string; value?: Record<string, unknown> }[] }[] }).entry ?? [];
    const k = (s: string) => (s.length > 180 ? `h:${sha(s)}` : s);
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const field = String(change.field ?? "unknown").slice(0, 40);
        const value = change.value ?? {};
        if (field === "messages") {
          const meta = value["metadata"] as { phone_number_id?: string } | undefined;
          if (wa && meta?.phone_number_id && meta.phone_number_id !== wa.phoneNumberId) continue; // another number on the account
          const contacts = (value["contacts"] as { wa_id?: string; profile?: { name?: string } }[] | undefined) ?? [];
          for (const m of (value["messages"] as { id: string; from: string }[] | undefined) ?? []) {
            out.push({ key: k(`in:${m.id}`), field: "messages.message", payload: { message: m, profileName: contacts.find((c) => c.wa_id === m.from)?.profile?.name ?? null } });
          }
          for (const s of (value["statuses"] as { id: string; status: string; timestamp: string }[] | undefined) ?? []) {
            out.push({ key: k(`st:${s.id}:${s.status}:${s.timestamp}`), field: "messages.status", payload: { status: s } });
          }
          for (const e of (value["errors"] as unknown[] | undefined) ?? []) out.push({ key: `err:${sha(JSON.stringify(e))}`, field: "messages.error", payload: { error: e } });
        } else {
          out.push({ key: `${field.slice(0, 40)}:${sha(JSON.stringify({ id: entry.id, value }))}`, field, payload: value });
        }
      }
    }
    return out;
  }

  /** Signed Meta delivery → stored first (unique key = processed once), then applied. */
  async function handleWebhook(raw: Buffer, signature: string | undefined) {
    if (!wa) throw new HttpError(503, "whatsapp_not_configured", "WhatsApp isn't configured on this server.");
    if (!verifyMetaSignature(raw, signature, wa.appSecret)) {
      await patchHealth({ lastSignatureFailureAt: now().toISOString() }).catch(() => undefined);
      throw new HttpError(401, "bad_signature", "Signature check failed.");
    }
    let body: unknown;
    try { body = JSON.parse(raw.toString("utf8")); } catch { throw new HttpError(400, "invalid_json", "Body is not JSON."); }
    if ((body as { object?: string }).object !== "whatsapp_business_account") return { received: true, stored: 0, duplicates: 0 };
    const stored: WhatsAppWebhookEvent[] = [];
    let duplicates = 0;
    for (const item of explode(body)) {
      try {
        stored.push(await prisma.whatsAppWebhookEvent.create({ data: { dedupeKey: item.key, field: item.field, payload: item.payload as Prisma.InputJsonValue } }));
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") { duplicates++; continue; }
        throw e; // not stored → 5xx so Meta delivers it again
      }
    }
    await patchHealth({ lastWebhookAt: now().toISOString() }).catch(() => undefined);
    const started = Date.now();
    for (const ev of stored) {
      if (Date.now() - started > 3_000) break; // the worker finishes the rest; Meta wants a quick 200
      await processEvent(ev);
    }
    return { received: true, stored: stored.length, duplicates };
  }

  function verifySubscription(q: Record<string, unknown>): string | null {
    if (!wa) return null;
    const mode = q["hub.mode"], token = q["hub.verify_token"], challenge = q["hub.challenge"];
    if (mode !== "subscribe" || typeof token !== "string" || typeof challenge !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(challenge)) return null;
    if (!safeEqual(token, wa.verifyToken)) return null;
    void patchHealth({ lastVerifiedAt: now().toISOString() }).catch(() => undefined);
    return challenge;
  }

  async function processEvent(ev: WhatsAppWebhookEvent) {
    try {
      const outcome = await applyEvent(ev);
      if (outcome === "deferred") {
        const attempts = ev.attempts + 1;
        if (attempts >= 40) await prisma.whatsAppWebhookEvent.update({ where: { id: ev.id }, data: { attempts, processedAt: now(), outcome: "unmatched", processingError: "No sent message with this id was found." } });
        else await prisma.whatsAppWebhookEvent.update({ where: { id: ev.id }, data: { attempts, nextAttemptAt: new Date(now().getTime() + Math.min(60, 2 ** Math.min(attempts, 6)) * 60_000), outcome: "deferred" } });
      } else {
        await prisma.whatsAppWebhookEvent.update({ where: { id: ev.id }, data: { attempts: ev.attempts + 1, processedAt: now(), outcome, processingError: null } });
      }
    } catch (e) {
      const attempts = ev.attempts + 1;
      const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
      logger.error("whatsapp webhook processing failed", { id: ev.id, field: ev.field, error: msg });
      await prisma.whatsAppWebhookEvent.update({
        where: { id: ev.id },
        data: attempts >= 10 ? { attempts, processedAt: now(), outcome: "failed", processingError: msg } : { attempts, nextAttemptAt: new Date(now().getTime() + backoffMs(attempts)), processingError: msg },
      }).catch(() => undefined);
    }
  }

  /** Pending inbox rows, oldest due first; deferred rows move back by their own backoff, so they can't starve others. */
  async function processPendingEvents(limit = 50) {
    const due = await prisma.whatsAppWebhookEvent.findMany({ where: { processedAt: null, nextAttemptAt: { lte: now() } }, orderBy: { nextAttemptAt: "asc" }, take: limit });
    for (const ev of due) await processEvent(ev);
    return { processed: due.length };
  }

  async function applyPendingStatuses(waMessageId: string) {
    const rows = await prisma.whatsAppWebhookEvent.findMany({ where: { processedAt: null, dedupeKey: { startsWith: `st:${waMessageId}:` } }, orderBy: { receivedAt: "asc" } });
    for (const ev of rows) await processEvent(ev);
  }

  async function applyEvent(ev: WhatsAppWebhookEvent): Promise<string> {
    const p = ev.payload as Record<string, unknown>;
    switch (ev.field) {
      case "messages.status": return applyStatus(p["status"] as MetaStatus);
      case "messages.message": return applyInbound(p["message"] as MetaInbound, (p["profileName"] as string | null) ?? null);
      case "messages.error": {
        const e = p["error"] as { code?: number; title?: string; message?: string; error_data?: { details?: string } };
        await prisma.whatsAppApiError.create({ data: { operation: "webhook.error", code: e.code ?? null, title: describeMetaError(e.code ?? null, e.title ?? e.message ?? "WhatsApp error").slice(0, 300), detail: e.error_data?.details?.slice(0, 500) ?? null } });
        return "applied";
      }
      case "message_template_status_update": {
        templateCache = null;
        const h = await health();
        const evt = { name: String(p["message_template_name"] ?? ""), event: String(p["event"] ?? ""), reason: (p["reason"] as string | null) ?? null, at: now().toISOString() };
        await patchHealth({ templateEvents: [evt, ...(h.templateEvents ?? [])].slice(0, 20) });
        return "applied";
      }
      case "message_template_quality_update":
      case "message_template_components_update":
      case "template_category_update":
        templateCache = null;
        return "applied";
      case "account_update": {
        const event = String(p["event"] ?? "");
        const banned = (p["ban_info"] as { waba_ban_state?: string } | undefined)?.waba_ban_state;
        if (event === "ACCOUNT_RECONNECTED" || (event === "DISABLED_UPDATE" && banned && banned !== "DISABLE")) await patchHealth({ accountBlocked: null });
        else if (BLOCK_EVENTS.has(event) && (event !== "DISABLED_UPDATE" || banned === "DISABLE")) await patchHealth({ accountBlocked: { event, at: now().toISOString() } });
        return "applied";
      }
      case "phone_number_quality_update":
        await patchHealth({ quality: { event: String(p["event"] ?? ""), currentLimit: (p["current_limit"] as string | undefined) ?? null, at: now().toISOString() } });
        statusCache = null;
        return "applied";
      default:
        return "ignored"; // stored for the record, nothing to do
    }
  }

  interface MetaStatus { id: string; status: string; timestamp: string; recipient_id?: string; errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[] }
  async function applyStatus(s: MetaStatus): Promise<string> {
    const incoming = metaStatusToState(s.status);
    if (!incoming) return "ignored";
    const at = Number.isFinite(Number(s.timestamp)) ? new Date(Number(s.timestamp) * 1000) : now();
    return prisma.$transaction(async (tx) => {
      const found = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM WhatsAppMessage WHERE waMessageId = ${s.id} FOR UPDATE`;
      if (!found[0]) return "deferred"; // the send may still be saving its id — retried shortly
      const msg = await tx.whatsAppMessage.findUniqueOrThrow({ where: { id: found[0].id } });
      const current = (["ACCEPTED", "SENT", "DELIVERED", "READ", "FAILED"].includes(msg.state) ? msg.state : "ACCEPTED") as DeliveryState;
      const merged = mergeDeliveryState(current, incoming);
      const data: Prisma.WhatsAppMessageUpdateInput = { state: merged };
      if (incoming === "SENT" && !msg.sentAt) data.sentAt = at;
      if (incoming === "DELIVERED" && !msg.deliveredAt) data.deliveredAt = at;
      if (incoming === "READ" && !msg.readAt) data.readAt = at;
      if (incoming === "FAILED") {
        if (!msg.failedAt) data.failedAt = at;
        const e = s.errors?.[0];
        if (e) {
          data.errorCode = e.code ?? null;
          data.errorTitle = describeMetaError(e.code ?? null, e.title ?? e.message ?? "Delivery failed").slice(0, 300);
          data.errors = s.errors as unknown as Prisma.InputJsonValue;
          if (e.code === 131050) await recordConsent(tx, { phone: msg.phone, purpose: CONSENT.marketing, status: "OPTED_OUT", source: "meta_stopped_marketing", customerId: msg.customerId });
        }
      }
      await tx.whatsAppMessage.update({ where: { id: msg.id }, data });
      return "applied";
    });
  }

  interface MetaInbound { id: string; from: string; timestamp: string; type: string; text?: { body?: string }; button?: { text?: string }; interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } }; image?: { id?: string; mime_type?: string }; document?: { id?: string; mime_type?: string } }
  async function applyInbound(m: MetaInbound, profileName: string | null): Promise<string> {
    const phone = String(m.from ?? "").replace(/\D/g, "").slice(0, 20);
    if (!phone) return "ignored";
    const text = (m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? `[${m.type}]`).slice(0, 2000);
    const at = Number.isFinite(Number(m.timestamp)) ? new Date(Number(m.timestamp) * 1000) : now();
    const local = localFromWa(phone);
    const customer = local ? await prisma.customer.findFirst({ where: { phone: local, deletedAt: null }, select: { id: true } }) : null;
    const created = await prisma.whatsAppMessage.createMany({
      skipDuplicates: true,
      data: [{ direction: "INBOUND", kind: "inbound", waMessageId: m.id, phone, customerId: customer?.id ?? null, body: text, state: "RECEIVED", createdAt: at, params: (m.image ?? m.document) ? ({ mediaId: (m.image ?? m.document)?.id ?? null, mime: (m.image ?? m.document)?.mime_type ?? null } as Prisma.InputJsonValue) : Prisma.DbNull }],
    });
    const row = await prisma.whatsAppMessage.findUniqueOrThrow({ where: { waMessageId: m.id } });
    // the reply's own dedupe key (reply:<id>) makes a re-run safe if a previous attempt crashed mid-way
    if (inboundHandler && (created.count === 1 || !(await prisma.whatsAppMessage.findUnique({ where: { dedupeKey: `reply:${m.id}` } })))) {
      await inboundHandler({ messageId: row.id, waMessageId: m.id, phone, text, type: m.type, profileName, customerId: customer?.id ?? null, at });
    }
    return "applied";
  }

  /* ───────── diagnostics ───────── */

  async function computeStatus() {
    const checks: { key: string; label: string; ok: boolean | null; detail: string }[] = [];
    const h = await health();
    const base = {
      configured: !!wa, appId: wa?.appId ?? null, wabaId: wa?.wabaId ?? null, phoneNumberId: wa?.phoneNumberId ?? null, graphVersion: wa?.graphVersion ?? null,
      webhook: { lastVerifiedAt: h.lastVerifiedAt ?? null, lastEventAt: h.lastWebhookAt ?? null, lastSignatureFailureAt: h.lastSignatureFailureAt ?? null, subscribed: null as boolean | null },
      accountBlocked: h.accountBlocked ?? null, quality: h.quality ?? null, templateEvents: h.templateEvents ?? [],
    };
    if (!wa || !graph) {
      return { ...base, state: "not-validated" as const, displayPhoneNumber: null, verifiedName: null, qualityRating: null, messagingLimit: null, permissions: [] as string[], checkedAt: now().toISOString(), error: "WhatsApp isn't configured on the server — set the WHATSAPP_* variables on Hostinger.", checks, phone: null as Record<string, unknown> | null, templates: { total: 0, approved: 0 } };
    }
    let phone: Record<string, unknown> | null = null;
    let tokenInvalid = false;
    let firstError: string | null = null;
    const note = (e: unknown) => { if (e instanceof MetaApiError) { if (e.kind === "token") tokenInvalid = true; firstError ??= e.reason; } else firstError ??= "Unexpected error while checking."; };
    try {
      phone = await graph.get<Record<string, unknown>>("status.phone", wa.phoneNumberId, { fields: "display_phone_number,verified_name,quality_rating,code_verification_status,name_status,messaging_limit_tier,platform_type,throughput,status" });
      checks.push({ key: "auth", label: "Access token accepted by Meta", ok: true, detail: "Authenticated request succeeded." });
      checks.push({ key: "phone", label: "Phone number readable", ok: true, detail: `${String(phone["display_phone_number"] ?? "")} · ${String(phone["verified_name"] ?? "")}` });
    } catch (e) {
      if (e instanceof MetaApiError) await recordApiError(e);
      note(e);
      checks.push({ key: "auth", label: "Access token accepted by Meta", ok: !(e instanceof MetaApiError && e.kind === "token"), detail: e instanceof MetaApiError ? e.reason : "Failed" });
    }
    let linked: boolean | null = null;
    try {
      const nums = await graph.get<{ data?: { id: string }[] }>("status.waba_numbers", `${wa.wabaId}/phone_numbers`, { fields: "id,display_phone_number" });
      linked = (nums.data ?? []).some((n) => n.id === wa.phoneNumberId);
      checks.push({ key: "waba", label: `Number ${wa.phoneNumberId} belongs to business account ${wa.wabaId}`, ok: linked, detail: linked ? "Linked." : "This phone number id isn't listed under the business account — check WHATSAPP_WABA_ID / WHATSAPP_PHONE_NUMBER_ID." });
    } catch (e) { if (e instanceof MetaApiError) await recordApiError(e); note(e); checks.push({ key: "waba", label: "Business account readable", ok: false, detail: e instanceof MetaApiError ? e.reason : "Failed" }); }
    let tplCount = { total: 0, approved: 0 };
    let tplOk = false;
    try {
      const list = await templates(true);
      tplOk = true;
      tplCount = { total: list.length, approved: list.filter((t) => t.status === "APPROVED").length };
      checks.push({ key: "templates", label: "Message templates readable", ok: true, detail: `${tplCount.approved} approved of ${tplCount.total}.` });
    } catch (e) { note(e); checks.push({ key: "templates", label: "Message templates readable", ok: false, detail: e instanceof MetaApiError ? e.reason : "Failed" }); }
    try {
      const subs = await graph.get<{ data?: { whatsapp_business_api_data?: { id?: string } }[] }>("status.subscribed_apps", `${wa.wabaId}/subscribed_apps`);
      base.webhook.subscribed = (subs.data ?? []).some((s) => s.whatsapp_business_api_data?.id === wa.appId);
      checks.push({ key: "subscription", label: "App subscribed to the business account's webhooks", ok: base.webhook.subscribed, detail: base.webhook.subscribed ? "Subscribed." : `App ${wa.appId} isn't subscribed — run POST /${wa.wabaId}/subscribed_apps (see server/README.md).` });
    } catch (e) { note(e); checks.push({ key: "subscription", label: "Webhook subscription readable", ok: false, detail: e instanceof MetaApiError ? e.reason : "Failed" }); }
    checks.push({ key: "webhook", label: "Meta verified the webhook address", ok: h.lastVerifiedAt ? true : null, detail: h.lastVerifiedAt ? `Last handshake ${h.lastVerifiedAt}` : "No handshake received yet — press Verify and save in Meta → WhatsApp → Configuration." });
    const anyAccepted = await prisma.whatsAppMessage.count({ where: { direction: "OUTBOUND", state: { in: [...DELIVERED_STATES] } } });
    const connected = !!phone && linked === true && tplOk;
    if (connected && h.tokenInvalidAt) await patchHealth({ tokenInvalidAt: null, tokenError: null });
    return {
      ...base,
      state: (tokenInvalid ? "token-invalid" : connected ? "connected" : "not-validated") as "token-invalid" | "connected" | "not-validated",
      displayPhoneNumber: (phone?.["display_phone_number"] as string | undefined) ?? null,
      verifiedName: (phone?.["verified_name"] as string | undefined) ?? null,
      qualityRating: (phone?.["quality_rating"] as string | undefined) ?? null,
      messagingLimit: tierLimit((phone?.["messaging_limit_tier"] as string | undefined) ?? null),
      permissions: [...(tplOk ? ["whatsapp_business_management"] : []), ...(anyAccepted > 0 ? ["whatsapp_business_messaging"] : [])],
      checkedAt: now().toISOString(),
      error: connected ? null : firstError ?? "Some checks did not pass.",
      checks,
      phone: phone ? { ...phone, messagingLimitTier: phone["messaging_limit_tier"] ?? null } : null,
      templates: tplCount,
    };
  }

  async function status(force = false) {
    if (!force && statusCache && Date.now() - statusCache.at < 60_000) return statusCache.value;
    const value = await computeStatus();
    statusCache = { at: Date.now(), value };
    return value;
  }

  /** Purpose → template, with Meta's live status for each, for the admin screen. */
  async function templateOverview() {
    const map = await templateMap();
    let list: MetaTemplate[] = [];
    let error: string | null = null;
    if (wa) { try { list = await templates(true); } catch (e) { error = e instanceof MetaApiError ? e.reason : "Couldn't read templates."; } }
    const purposes = await Promise.all(PURPOSE_KEYS.map(async (k) => {
      const ready = wa && !error ? await purposeReady(k) : { ok: false as const, reason: error ?? "WhatsApp isn't configured on the server." };
      return { purpose: k, label: PURPOSES[k].label, category: PURPOSES[k].category, variables: PURPOSES[k].vars, suggested: PURPOSES[k].suggested, template: map[k], ready: ready.ok, reason: ready.ok ? null : ready.reason };
    }));
    return {
      purposes,
      templates: list.map((t) => ({ name: t.name, language: t.language, status: t.status, category: t.category, variables: templateShape(t).bodyVars, hasLinkButton: templateShape(t).urlButtonIndex !== null })),
      error,
    };
  }

  /* ───────── housekeeping ───────── */

  async function purge() {
    const t = now().getTime();
    const [events, otps, errors] = await Promise.all([
      prisma.whatsAppWebhookEvent.deleteMany({ where: { processedAt: { lt: new Date(t - 30 * 86_400_000) } } }),
      prisma.whatsAppOtp.deleteMany({ where: { createdAt: { lt: new Date(t - 2 * 86_400_000) } } }),
      prisma.whatsAppApiError.deleteMany({ where: { createdAt: { lt: new Date(t - 90 * 86_400_000) } } }),
    ]);
    return { events: events.count, otps: otps.count, errors: errors.count };
  }

  return {
    configured: !!wa,
    graph,
    newId: randomUUID,
    templateMap,
    async saveTemplateMap(input: unknown) {
      const parsed = templateMapSchema.parse(input);
      const merged = { ...(await templateMap()), ...parsed };
      await writeSetting(KEYS.map, merged);
      return merged;
    },
    automations,
    async saveAutomations(input: unknown) {
      const parsed = automationSchema.parse(input);
      await writeSetting(KEYS.automations, parsed);
      return parsed;
    },
    health,
    patchHealth,
    templates,
    purposeReady,
    resolveTemplate,
    templateOverview,
    latestConsent,
    cartReminderConsent,
    recordConsent,
    consentOf: (phone: string, purpose: ConsentPurpose) => latestConsent(prisma, phone, purpose),
    setConsent: (input: Parameters<typeof recordConsent>[1]) => recordConsent(prisma, input),
    enqueue,
    sendNow,
    processQueue,
    recordApiError,
    handleWebhook,
    verifySubscription,
    processPendingEvents,
    applyPendingStatuses,
    status,
    invalidate() { templateCache = null; statusCache = null; },
    setInboundHandler(h: InboundHandler) { inboundHandler = h; },
    /** ask the background worker to look at the queue now (after an order commit, a chatbot reply …) */
    kick() { kicker?.(); },
    setKicker(k: (() => void) | null) { kicker = k; },
    purge,
    BACKOFF_MINUTES,
  };
}
export type WhatsAppService = ReturnType<typeof createWhatsAppService>;
