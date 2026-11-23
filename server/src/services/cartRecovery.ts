// Abandoned-checkout reminders. The website tells the server when a shopper with WhatsApp consent
// reaches checkout; six hours after their last activity, if no order arrived, one approved template
// reminder is queued. Everything is in MySQL, so restarts lose nothing, and the claim + unique
// dedupe key mean each checkout is reminded at most once.
import { createHash, randomBytes } from "node:crypto";

import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import type { Config } from "../config.js";
import { HttpError } from "../errors.js";
import { cartLineSchema } from "../lib/checkoutSchema.js";
import { isIndianMobile, normalizeIndianPhone } from "../lib/india.js";
import { CONSENT, maskPhone } from "../lib/whatsapp.js";
import type { Logger } from "../logger.js";
import { lineTotal } from "../lib/pricing.js";
import { priceLines } from "./checkoutService.js";
import { firstName } from "./whatsappOrders.js";
import type { WhatsAppService } from "./whatsappService.js";

export const REMINDER_DELAY_MS = 6 * 3_600_000;
/** a reminder that couldn't go out within two days of being due is dropped, never sent late */
const GIVE_UP_MS = 48 * 3_600_000;
const LINK_LIFE_MS = 7 * 86_400_000;

export const checkoutStartedSchema = z.object({
  checkoutKey: z.string().uuid(),
  lines: z.array(cartLineSchema).min(1).max(30),
  contact: z.object({
    name: z.string().trim().min(2).max(120).refine((s) => !/[\u0000-\u001f\u007f<>]/.test(s), "Name has characters that aren't allowed"),
    phone: z.string().max(20).transform(normalizeIndianPhone).refine(isIndianMobile, "Enter a valid 10-digit Indian mobile number"),
  }),
  /** the shopper ticked "remind me on WhatsApp if I don't finish" */
  reminderConsent: z.boolean(),
});
export const recoverSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{20,80}$/) });

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export function createCartRecovery(deps: { prisma: PrismaClient; config: Config; wa: WhatsAppService; logger: Logger; now?: () => Date }) {
  const { prisma, config, wa, logger } = deps;
  const now = deps.now ?? (() => new Date());

  async function started(input: z.infer<typeof checkoutStartedSchema>, customerId: string | null) {
    if (!wa.configured) return { tracking: false };
    const phone = `91${input.contact.phone}`;
    const t = now();
    if (!input.reminderConsent) {
      await prisma.abandonedCheckout.updateMany({ where: { checkoutKey: input.checkoutKey, status: "OPEN" }, data: { status: "SKIPPED", skipReason: "The shopper unticked the reminder." } });
      return { tracking: false };
    }
    const { priced } = await priceLines(prisma, input.lines, 100);
    if (!priced.length) return { tracking: false };
    const lines = priced.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity }));
    const subtotalPaise = priced.reduce((s, l) => s + lineTotal(l), 0);
    await wa.recordConsent(prisma, { phone, purpose: CONSENT.marketing, status: "OPTED_IN", source: "checkout_reminder", customerId });
    const existing = await prisma.abandonedCheckout.findUnique({ where: { checkoutKey: input.checkoutKey } });
    if (existing && existing.status !== "OPEN" && existing.status !== "SKIPPED") return { tracking: false };
    const remindAt = new Date(t.getTime() + REMINDER_DELAY_MS);
    await prisma.$transaction([
      // one reminder per shopper: an older open checkout from the same number is replaced
      prisma.abandonedCheckout.updateMany({ where: { phone, status: "OPEN", checkoutKey: { not: input.checkoutKey } }, data: { status: "SKIPPED", skipReason: "Replaced by a newer checkout." } }),
      prisma.abandonedCheckout.upsert({
        where: { checkoutKey: input.checkoutKey },
        create: { checkoutKey: input.checkoutKey, name: input.contact.name, phone, customerId, lines, subtotalPaise, lastActivityAt: t, remindAt },
        update: { name: input.contact.name, phone, customerId, lines, subtotalPaise, lastActivityAt: t, remindAt, status: "OPEN", skipReason: null },
      }),
    ]);
    return { tracking: true, remindAt: remindAt.toISOString() };
  }

  /** Called by the worker: queue reminders that are due. */
  async function processDue(limit = 50) {
    if (!wa.configured || !(await wa.automations()).abandonedCart) return { queued: 0 };
    const t = now();
    const due = await prisma.abandonedCheckout.findMany({ where: { status: "OPEN", remindAt: { lte: t } }, orderBy: { remindAt: "asc" }, take: limit });
    let queued = 0;
    let ready: Awaited<ReturnType<WhatsAppService["purposeReady"]>> | null = null;
    for (const c of due) {
      const set = (data: Parameters<typeof prisma.abandonedCheckout.updateMany>[0]["data"]) => prisma.abandonedCheckout.updateMany({ where: { id: c.id, status: "OPEN" }, data });
      if (t.getTime() - c.remindAt.getTime() > GIVE_UP_MS) { await set({ status: "EXPIRED", skipReason: c.skipReason ?? "Couldn't be sent in time." }); continue; }
      const ordered = await prisma.order.findFirst({ where: { phone: c.phone.slice(2), createdAt: { gte: c.createdAt } }, select: { id: true } });
      if (ordered) { await set({ status: "CONVERTED", orderId: ordered.id }); continue; }
      if ((await wa.latestConsent(prisma, c.phone, CONSENT.marketing)) !== "OPTED_IN") { await set({ status: "SKIPPED", skipReason: "The customer opted out of WhatsApp offers." }); continue; }
      ready ??= await wa.purposeReady("abandoned_cart");
      if (!ready.ok) { await set({ skipReason: `Waiting: ${ready.reason}` }); continue; }
      const token = randomBytes(24).toString("base64url");
      const link = `${config.publicSiteUrl}/cart?recover=${token}`;
      const claimed = await prisma.$transaction(async (tx) => {
        const n = await tx.abandonedCheckout.updateMany({ where: { id: c.id, status: "OPEN" }, data: { status: "REMINDED", remindedAt: t, recoveryHash: sha(token), skipReason: null } });
        if (n.count !== 1) return false;
        await wa.enqueue(tx, { kind: "cart", purpose: "abandoned_cart", dedupeKey: `cart:${c.id}`, phone: c.phone, customerId: c.customerId, values: { body: [firstName(c.name), link], button: token } });
        return true;
      });
      if (claimed) queued++;
    }
    if (queued) { logger.info("bag reminders queued", { queued }); wa.kick(); }
    return { queued };
  }

  /** The bag link from the reminder: returns product ids and quantities only — no name, number or prices. */
  async function recover(token: string) {
    const c = await prisma.abandonedCheckout.findUnique({ where: { recoveryHash: sha(token) } });
    if (!c || !c.remindedAt || now().getTime() - c.remindedAt.getTime() > LINK_LIFE_MS) throw new HttpError(404, "link_expired", "This bag link has expired. Your products are still in the shop.");
    if (!c.recoveredAt) await prisma.abandonedCheckout.update({ where: { id: c.id }, data: { recoveredAt: now() } });
    return { lines: c.lines as { productId: string; variantId: string; quantity: number }[] };
  }

  async function list(input: { status?: string | undefined; page: number }, showPhones: boolean) {
    const where = input.status ? { status: input.status as "OPEN" } : {};
    const [rows, total, counts] = await Promise.all([
      prisma.abandonedCheckout.findMany({ where, orderBy: { createdAt: "desc" }, skip: (input.page - 1) * 50, take: 50 }),
      prisma.abandonedCheckout.count({ where }),
      prisma.abandonedCheckout.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    const msgs = await prisma.whatsAppMessage.findMany({ where: { dedupeKey: { in: rows.map((r) => `cart:${r.id}`) } }, select: { dedupeKey: true, state: true, errorTitle: true } });
    const byKey = new Map(msgs.map((m) => [m.dedupeKey, m]));
    return {
      carts: rows.map((r) => ({
        id: r.id, name: r.name, phone: showPhones ? `+${r.phone}` : maskPhone(r.phone), items: (r.lines as unknown[]).length, subtotalPaise: r.subtotalPaise,
        status: r.status, lastActivityAt: r.lastActivityAt.toISOString(), remindAt: r.remindAt.toISOString(), remindedAt: r.remindedAt?.toISOString() ?? null,
        recoveredAt: r.recoveredAt?.toISOString() ?? null, orderId: r.orderId, note: r.skipReason,
        message: byKey.get(`cart:${r.id}`) ? { state: byKey.get(`cart:${r.id}`)!.state, error: byKey.get(`cart:${r.id}`)!.errorTitle } : null,
      })),
      total,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
    };
  }

  return { started, processDue, recover, list };
}
export type CartRecoveryService = ReturnType<typeof createCartRecovery>;
