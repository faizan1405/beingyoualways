// WhatsApp marketing campaigns. Saving a draft never sends anything. A permitted admin must approve
// the exact audience size; only then are recipients queued for the scheduled time, re-checked for
// consent when each message is sent, and capped by the daily marketing limit. Reports count only
// what Meta reported — no invented opens or conversions.
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import type { Config } from "../config.js";
import { HttpError, notFound } from "../errors.js";
import { CONSENT, localFromWa, maskPhone, templateShape } from "../lib/whatsapp.js";
import { logActivity, type Actor } from "./activity.js";
import { firstName } from "./whatsappOrders.js";
import type { WhatsAppService } from "./whatsappService.js";

export const segmentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all_opted_in") }),
  z.object({ kind: z.literal("has_ordered") }),
  z.object({ kind: z.literal("no_order_days"), days: z.number().int().min(7).max(730) }),
  z.object({ kind: z.literal("bought_category"), category: z.string().trim().regex(/^[a-z0-9-]{1,80}$/) }),
]);
export type Segment = z.infer<typeof segmentSchema>;

export const campaignInputSchema = z.object({
  name: z.string().trim().min(3, "Give the campaign a name").max(120),
  templateName: z.string().trim().regex(/^[a-z0-9_]{1,100}$/, "Choose an approved marketing template"),
  language: z.string().trim().regex(/^[a-z]{2,3}(_[A-Z]{2})?$/),
  segment: segmentSchema,
  /** one value per template variable; "{name}" → customer's first name, "{store_url}" → the shop */
  params: z.array(z.string().trim().min(1).max(200)).max(10),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
  maxRecipients: z.number().int().min(1).max(10_000),
});
export const approveSchema = z.object({ confirmRecipients: z.number().int().min(1) });

const SOLD = ["NEW", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

export function createCampaignService(deps: { prisma: PrismaClient; config: Config; wa: WhatsAppService; now?: () => Date }) {
  const { prisma, config, wa } = deps;
  const now = deps.now ?? (() => new Date());

  /** Who may receive marketing now: latest consent is "opted in", active account (if any), usable number. */
  async function audience(segment: Segment) {
    const rows = await prisma.whatsAppConsent.findMany({ where: { purpose: CONSENT.marketing }, orderBy: [{ recordedAt: "asc" }, { id: "asc" }], select: { phone: true, status: true } });
    const latest = new Map<string, string>();
    for (const r of rows) latest.set(r.phone, r.status);
    const optedIn = [...latest].filter(([, s]) => s === "OPTED_IN").map(([p]) => p);
    const optedOut = [...latest].filter(([, s]) => s === "OPTED_OUT").length;
    const locals = optedIn.map(localFromWa).filter((x): x is string => !!x);
    const [customers, orders] = await Promise.all([
      prisma.customer.findMany({ where: { phone: { in: locals } }, select: { id: true, phone: true, name: true, status: true, deletedAt: true } }),
      prisma.order.findMany({ where: { phone: { in: locals }, status: { in: [...SOLD] }, isTest: false }, select: { phone: true, customerName: true, createdAt: true, items: segment.kind === "bought_category" ? { select: { product: { select: { category: { select: { slug: true } } } } } } : false }, orderBy: { createdAt: "desc" } }),
    ]);
    const custBy = new Map(customers.map((c) => [c.phone, c]));
    const ordersBy = new Map<string, typeof orders>();
    for (const o of orders) { if (o.phone) ordersBy.set(o.phone, [...(ordersBy.get(o.phone) ?? []), o]); }
    const eligible: { phone: string; name: string; customerId: string | null }[] = [];
    let blocked = 0, notInSegment = 0;
    for (const phone of optedIn) {
      const local = localFromWa(phone);
      if (!local) continue;
      const c = custBy.get(local);
      if (c && (c.deletedAt || c.status !== "ACTIVE")) { blocked++; continue; }
      const os = ordersBy.get(local) ?? [];
      const inSegment =
        segment.kind === "all_opted_in" ? true
        : segment.kind === "has_ordered" ? os.length > 0
        : segment.kind === "no_order_days" ? os.length > 0 && now().getTime() - os[0]!.createdAt.getTime() > segment.days * 86_400_000
        : os.some((o) => (o as unknown as { items?: { product: { category: { slug: string } } | null }[] }).items?.some((i) => i.product?.category.slug === segment.category));
      if (!inSegment) { notInSegment++; continue; }
      eligible.push({ phone, name: c?.name || os[0]?.customerName || "", customerId: c?.id ?? null });
    }
    return { eligible, counts: { eligible: eligible.length, optedIn: optedIn.length, optedOut, blocked, notInSegment } };
  }

  const fill = (params: string[], name: string) => params.map((p) => p.replace(/\{name\}/g, firstName(name)).replace(/\{store_url\}/g, config.publicSiteUrl));

  async function report(ids: string[]) {
    const grouped = await prisma.whatsAppMessage.groupBy({ by: ["campaignId", "state"], where: { campaignId: { in: ids } }, _count: { _all: true } });
    const out = new Map<string, Record<string, number>>();
    for (const g of grouped) {
      const r = out.get(g.campaignId!) ?? {};
      r[g.state] = g._count._all;
      out.set(g.campaignId!, r);
    }
    return out;
  }

  const view = (c: Awaited<ReturnType<typeof prisma.whatsAppCampaign.findUniqueOrThrow>>, r: Record<string, number> = {}) => ({
    id: c.id, name: c.name, templateName: c.templateName, language: c.language, segment: c.segment, params: c.params, status: c.status,
    scheduledAt: c.scheduledAt?.toISOString() ?? null, maxRecipients: c.maxRecipients, recipientCount: c.recipientCount,
    approvedAt: c.approvedAt?.toISOString() ?? null, cancelledAt: c.cancelledAt?.toISOString() ?? null, completedAt: c.completedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    // counts from the message log only: queued, accepted by Meta, and the ticks Meta reported back
    report: { queued: r["QUEUED"] ?? 0, accepted: r["ACCEPTED"] ?? 0, sent: r["SENT"] ?? 0, delivered: r["DELIVERED"] ?? 0, read: r["READ"] ?? 0, failed: r["FAILED"] ?? 0, skipped: r["SKIPPED"] ?? 0 },
  });

  async function get(id: string) {
    const c = await prisma.whatsAppCampaign.findUnique({ where: { id } });
    if (!c) throw notFound("Campaign not found.");
    return c;
  }

  return {
    audience,
    async list() {
      const rows = await prisma.whatsAppCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
      const r = await report(rows.map((c) => c.id));
      return { campaigns: rows.map((c) => view(c, r.get(c.id))) };
    },
    async detail(id: string, showPhones: boolean) {
      const c = await get(id);
      const r = await report([id]);
      const a = c.status === "DRAFT" ? await audience(c.segment as Segment) : null;
      const failures = await prisma.whatsAppMessage.findMany({ where: { campaignId: id, state: { in: ["FAILED", "SKIPPED"] } }, orderBy: { updatedAt: "desc" }, take: 50, select: { phone: true, state: true, errorCode: true, errorTitle: true } });
      return {
        campaign: view(c, r.get(id)),
        audience: a ? a.counts : null,
        sample: a ? a.eligible.slice(0, 5).map((x) => ({ phone: showPhones ? `+${x.phone}` : maskPhone(x.phone), name: x.name })) : [],
        failures: failures.map((f) => ({ ...f, phone: showPhones ? `+${f.phone}` : maskPhone(f.phone) })),
      };
    },
    async create(input: z.infer<typeof campaignInputSchema>, actor: Actor) {
      const c = await prisma.whatsAppCampaign.create({ data: { name: input.name, templateName: input.templateName, language: input.language, segment: input.segment, params: input.params, scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null, maxRecipients: input.maxRecipients, createdById: actor.userId } });
      await logActivity(prisma, actor, { action: "whatsapp.campaign.create", entityType: "whatsapp_campaign", entityId: c.id, summary: `Draft campaign “${c.name}” saved (nothing sent)` });
      return view(c);
    },
    async update(id: string, input: z.infer<typeof campaignInputSchema>, actor: Actor) {
      const c = await get(id);
      if (c.status !== "DRAFT") throw new HttpError(409, "campaign_locked", "Only a draft can be edited. Cancel it and create a new one.");
      const u = await prisma.whatsAppCampaign.update({ where: { id }, data: { name: input.name, templateName: input.templateName, language: input.language, segment: input.segment, params: input.params, scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null, maxRecipients: input.maxRecipients } });
      await logActivity(prisma, actor, { action: "whatsapp.campaign.update", entityType: "whatsapp_campaign", entityId: id, summary: `Draft campaign “${u.name}” edited` });
      return view(u);
    },
    /** The explicit approval: the admin confirms the audience size they saw; recipients are queued. */
    async approve(id: string, confirmRecipients: number, actor: Actor) {
      const c = await get(id);
      if (c.status !== "DRAFT") throw new HttpError(409, "campaign_locked", "This campaign was already approved or cancelled.");
      if (!wa.configured) throw new HttpError(409, "whatsapp_not_configured", "WhatsApp isn't connected on the server, so nothing can be sent.");
      const tpl = await wa.resolveTemplate(c.templateName, c.language, "MARKETING");
      if (!tpl.ok) throw new HttpError(409, "template_not_ready", tpl.reason);
      const shape = templateShape(tpl.template);
      const params = c.params as string[];
      if (shape.unsupportedHeader || shape.urlButtonIndex !== null) throw new HttpError(409, "template_not_supported", "Campaign templates must have only text variables in the body (no media header or link-button variable).");
      if (shape.bodyVars !== params.length) throw new HttpError(409, "template_mismatch", `The template has ${shape.bodyVars} variable(s); the campaign fills ${params.length}.`);
      if (c.scheduledAt && c.scheduledAt.getTime() < now().getTime() - 5 * 60_000) throw new HttpError(409, "schedule_past", "The scheduled time is in the past. Edit the campaign first.");
      const a = await audience(c.segment as Segment);
      if (a.eligible.length === 0) throw new HttpError(409, "no_recipients", "No customers in this audience have agreed to WhatsApp offers.");
      if (a.eligible.length !== confirmRecipients) throw new HttpError(409, "audience_changed", `The audience is now ${a.eligible.length} customers (you confirmed ${confirmRecipients}). Check it and approve again.`, { recipients: a.eligible.length });
      if (a.eligible.length > c.maxRecipients) throw new HttpError(409, "over_limit", `${a.eligible.length} recipients is more than this campaign's limit of ${c.maxRecipients}.`);
      const at = c.scheduledAt && c.scheduledAt > now() ? c.scheduledAt : now();
      await prisma.$transaction(async (tx) => {
        const n = await tx.whatsAppCampaign.updateMany({ where: { id, status: "DRAFT" }, data: { status: "APPROVED", approvedById: actor.userId, approvedAt: now(), recipientCount: a.eligible.length, scheduledAt: at } });
        if (n.count !== 1) throw new HttpError(409, "campaign_locked", "This campaign was already approved or cancelled.");
        for (const r of a.eligible) {
          await wa.enqueue(tx, { kind: "campaign", dedupeKey: `campaign:${id}:${r.phone}`, phone: r.phone, customerId: r.customerId, campaignId: id, templateName: c.templateName, language: c.language, values: { body: fill(params, r.name) }, notBefore: at });
        }
        await logActivity(tx, actor, { action: "whatsapp.campaign.approve", entityType: "whatsapp_campaign", entityId: id, summary: `Campaign “${c.name}” approved for ${a.eligible.length} opted-in customers, sending from ${at.toISOString()}` });
      }, { timeout: 60_000 });
      wa.kick();
      return view(await get(id), (await report([id])).get(id));
    },
    async cancel(id: string, actor: Actor) {
      const c = await get(id);
      if (c.status !== "DRAFT" && c.status !== "APPROVED") throw new HttpError(409, "campaign_locked", "This campaign has already finished or was cancelled.");
      await prisma.$transaction(async (tx) => {
        await tx.whatsAppCampaign.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: now() } });
        await tx.whatsAppMessage.updateMany({ where: { campaignId: id, state: "QUEUED" }, data: { state: "SKIPPED", nextAttemptAt: null, errorTitle: "Campaign cancelled before this message was sent." } });
        await logActivity(tx, actor, { action: "whatsapp.campaign.cancel", entityType: "whatsapp_campaign", entityId: id, summary: `Campaign “${c.name}” cancelled` });
      });
      return view(await get(id), (await report([id])).get(id));
    },
    /** worker: approved campaigns with nothing left in the queue are complete */
    async completeFinished() {
      const open = await prisma.whatsAppCampaign.findMany({ where: { status: "APPROVED", scheduledAt: { lte: now() } }, select: { id: true } });
      for (const c of open) {
        const left = await prisma.whatsAppMessage.count({ where: { campaignId: c.id, state: "QUEUED" } });
        if (left === 0) await prisma.whatsAppCampaign.updateMany({ where: { id: c.id, status: "APPROVED" }, data: { status: "COMPLETED", completedAt: now() } });
      }
    },
  };
}
export type CampaignService = ReturnType<typeof createCampaignService>;
