// WhatsApp chatbot. Answers only from store records: an order's status is shared only when the
// order's phone number is the sender's WhatsApp number; product names and prices come from the
// catalogue; shipping wording from the confirmed settings; refunds point to the published policy.
// Anything else (or anything unclear) is handed to a person. Replies are free-form text, which
// WhatsApp allows within 24 hours of the customer's message.
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import type { Config } from "../config.js";
import { formatInr, toPaise } from "../lib/money.js";
import { STATUS_LABEL } from "../lib/orderStatus.js";
import { CONSENT, detectIntent, localFromWa, orderNumberIn, productKeywords } from "../lib/whatsapp.js";
import type { Logger } from "../logger.js";
import { orderToken } from "./orderLinks.js";
import type { SettingsService } from "./settingsService.js";
import type { InboundMessage, WhatsAppService } from "./whatsappService.js";

export const chatbotSchema = z.object({
  greeting: z.string().trim().min(5).max(600),
  handoffText: z.string().trim().min(5).max(400),
  supportHours: z.string().trim().max(120),
});
export type ChatbotSettings = z.infer<typeof chatbotSchema>;
export const DEFAULT_CHATBOT: ChatbotSettings = {
  greeting: "Hi! This is Being You – Always. You can ask me about:\n• your order — send your order number (BYA-…)\n• shipping\n• returns and refunds\n• a product by name\nOr type AGENT to talk to our team.",
  handoffText: "Thank you — I've passed your message to our team and someone will reply here.",
  supportHours: "",
};
const KEY = "whatsapp.chatbot";

export function createChatbot(deps: { prisma: PrismaClient; config: Config; wa: WhatsAppService; settings: SettingsService; logger: Logger }) {
  const { prisma, config, wa, settings, logger } = deps;
  const site = config.publicSiteUrl;

  async function getSettings(): Promise<ChatbotSettings> {
    const row = await prisma.storeSetting.findUnique({ where: { key: KEY } });
    return row ? { ...DEFAULT_CHATBOT, ...(row.value as object) } : DEFAULT_CHATBOT;
  }
  async function saveSettings(input: unknown) {
    const v = chatbotSchema.parse(input);
    await prisma.storeSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: v }, update: { value: v } });
    return v;
  }

  const orderLink = (n: string) => `${site}/order/${encodeURIComponent(n)}#t=${orderToken(config.orderLinkSecret, n)}`;

  async function orderReply(local: string, text: string): Promise<{ reply: string; handoff: boolean }> {
    const asked = orderNumberIn(text);
    const describe = (o: { orderNumber: string; status: keyof typeof STATUS_LABEL; carrier: string | null; trackingNumber: string | null; createdAt: Date }) =>
      `${o.orderNumber} (placed ${o.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}): ${STATUS_LABEL[o.status]}${o.status === "SHIPPED" && o.carrier && o.trackingNumber ? ` — ${o.carrier}, tracking ${o.trackingNumber}` : ""}.`;
    const select = { orderNumber: true, status: true, carrier: true, trackingNumber: true, createdAt: true } as const;
    if (asked) {
      const o = await prisma.order.findFirst({ where: { orderNumber: asked, phone: local }, select });
      if (!o) return { reply: `I couldn't find order ${asked} for this WhatsApp number. For your privacy I can only share orders placed with this number. Type AGENT and our team will help.`, handoff: false };
      return { reply: `${describe(o)}\nFull details: ${orderLink(o.orderNumber)}`, handoff: false };
    }
    const recent = await prisma.order.findMany({ where: { phone: local, status: { not: "PENDING_PAYMENT" } }, orderBy: { createdAt: "desc" }, take: 3, select });
    if (!recent.length) return { reply: "I couldn't find any orders placed with this WhatsApp number. If you used another number, send your order number (BYA-…) from that number, or type AGENT.", handoff: false };
    return { reply: `Your latest order${recent.length > 1 ? "s" : ""}:\n${recent.map(describe).join("\n")}\nSend an order number for its full details.`, handoff: false };
  }

  async function shippingReply(): Promise<{ reply: string; handoff: boolean }> {
    const cfg = (await settings.publicConfig()).shipping;
    if (!cfg.configured || cfg.flatFeePaise == null) return { reply: `Our shipping details are here: ${site}/shipping-policy. Type AGENT if you'd like our team to confirm anything for your PIN code.`, handoff: false };
    const parts = [cfg.flatFeePaise === 0 ? "Delivery is free." : `Delivery charge: ${formatInr(cfg.flatFeePaise)}${cfg.freeAbovePaise != null ? `, free on orders above ${formatInr(cfg.freeAbovePaise)}` : ""}.`];
    if (cfg.estimate) parts.push(`Usual delivery time: ${cfg.estimate}.`);
    if (cfg.limitedRegions) parts.push("We deliver to selected areas — checkout confirms your PIN code.");
    return { reply: `${parts.join(" ")}\nFull shipping policy: ${site}/shipping-policy`, handoff: false };
  }

  async function productReply(text: string): Promise<{ reply: string; handoff: boolean }> {
    const words = productKeywords(text);
    if (!words.length) return { reply: `You can browse everything here: ${site}/shop`, handoff: false };
    const matches = await prisma.product.findMany({
      where: { status: "ACTIVE", OR: words.map((w) => ({ name: { contains: w } })) },
      select: { name: true, slug: true, variants: { select: { price: true } } }, take: 30, orderBy: { sortOrder: "asc" },
    });
    // best match first: products whose name contains more of the words the customer used
    const score = (name: string) => words.filter((w) => name.toLowerCase().includes(w)).length;
    const found = matches.map((p, i) => ({ p, s: score(p.name), i })).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, 3).map((x) => x.p);
    if (!found.length) return { reply: `I couldn't find a product matching that. Browse the shop: ${site}/shop — or type AGENT to ask our team.`, handoff: false };
    const lines = found.map((p) => {
      const prices = p.variants.map((v) => toPaise(v.price)).filter((x) => x > 0);
      const from = prices.length ? ` — ${prices.length > 1 && Math.min(...prices) !== Math.max(...prices) ? "from " : ""}${formatInr(Math.min(...prices))}` : "";
      return `• ${p.name}${from}: ${site}/product/${p.slug}`;
    });
    return { reply: `${lines.join("\n")}\nThe product page shows whether it can be ordered right now.`, handoff: false };
  }

  async function reply(m: InboundMessage) {
    const s = await getSettings();
    const intent = detectIntent(m.text);
    const send = async (text: string) => {
      await wa.enqueue(prisma, { kind: "chatbot", dedupeKey: `reply:${m.waMessageId}`, phone: m.phone, customerId: m.customerId, text });
      wa.kick();
    };
    // STOP / START work even when the chatbot is off — they are the customer's consent
    if (intent === "opt-out") {
      await wa.recordConsent(prisma, { phone: m.phone, purpose: CONSENT.marketing, status: "OPTED_OUT", source: "whatsapp_stop", customerId: m.customerId });
      await send("You won't get offers or bag reminders from us on WhatsApp any more. Updates about orders you place still come here. Reply START to get offers again.");
      return;
    }
    if (intent === "opt-in") {
      await wa.recordConsent(prisma, { phone: m.phone, purpose: CONSENT.marketing, status: "OPTED_IN", source: "whatsapp_start", customerId: m.customerId });
      await send("Thank you — you'll get occasional offers from Being You – Always here. Reply STOP at any time to opt out.");
      return;
    }
    const auto = await wa.automations();
    const handoff = async () => {
      await prisma.whatsAppMessage.update({ where: { id: m.messageId }, data: { needsHuman: true } });
      // one "passed to our team" note per 12 hours, so a long conversation isn't spammed
      const recent = await prisma.whatsAppMessage.findFirst({ where: { phone: m.phone, kind: "chatbot", body: { startsWith: s.handoffText.slice(0, 40) }, createdAt: { gte: new Date(Date.now() - 12 * 3_600_000) } }, select: { id: true } });
      if (!recent && auto.chatbot) await send(`${s.handoffText}${s.supportHours ? ` (${s.supportHours})` : ""}`);
    };
    if (!auto.chatbot || !["text", "button", "interactive"].includes(m.type)) { await handoff(); return; }
    const local = localFromWa(m.phone);
    try {
      let out: { reply: string; handoff: boolean };
      switch (intent) {
        case "order-tracking": out = local ? await orderReply(local, m.text) : { reply: "I can only look up orders for Indian mobile numbers. Type AGENT for help.", handoff: false }; break;
        case "shipping": out = await shippingReply(); break;
        case "refund": out = { reply: `Our returns and refund policy: ${site}/refund-policy\nIf you'd like us to look at a specific order, type AGENT and send the order number — our team will check it.`, handoff: false }; break;
        case "product": out = await productReply(m.text); break;
        case "greeting": out = { reply: s.greeting, handoff: false }; break;
        default: await handoff(); return;
      }
      await send(out.reply);
    } catch (e) {
      logger.error("chatbot reply failed", { error: e instanceof Error ? e.message : String(e) });
      await handoff();
    }
  }

  return { reply, getSettings, saveSettings };
}
export type Chatbot = ReturnType<typeof createChatbot>;
