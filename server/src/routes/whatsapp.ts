import express, { Router, type Request } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";

import type { Config } from "../config.js";
import { HttpError, badRequest } from "../errors.js";
import { CONSENT, toWaDigits, type OrderPurpose } from "../lib/whatsapp.js";
import { requirePermission } from "../middleware/auth.js";
import { requireCustomer, setCustomerCookie } from "../middleware/customerAuth.js";
import { lookupLimiter } from "../middleware/security.js";
import { approveSchema, campaignInputSchema, type CampaignService } from "../services/campaignService.js";
import { bagReminderSchema, checkoutStartedSchema, recoverSchema, type CartRecoveryService } from "../services/cartRecovery.js";
import type { Chatbot } from "../services/chatbot.js";
import { consentInputSchema, messageFilterSchema, replySchema, testSchema, type WhatsAppAdmin } from "../services/whatsappAdmin.js";
import type { WhatsAppOtpService } from "../services/whatsappOtp.js";
import type { WhatsAppService } from "../services/whatsappService.js";

const noStore: express.RequestHandler = (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); };
const idParam = (v: unknown) => { const p = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).safeParse(v); if (!p.success) throw badRequest("Invalid id."); return p.data; };
const actor = (req: Request) => ({ userId: req.admin!.user.id, ip: req.ip });
const canSeePhones = (req: Request) => !!req.admin?.user.permissions.includes("customers.read");

/** Meta → us. Mounted before the JSON parser: the signature covers the exact raw bytes. */
export function whatsappWebhookRoutes(wa: WhatsAppService) {
  const r = Router();
  r.get("/", (req, res) => {
    const challenge = wa.verifySubscription(req.query as Record<string, unknown>);
    if (!challenge) { res.status(403).type("text/plain").send("Forbidden"); return; }
    res.status(200).type("text/plain").send(challenge);
  });
  r.post("/", express.raw({ type: "*/*", limit: "3mb" }), async (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    res.json(await wa.handleWebhook(raw, req.get("x-hub-signature-256")));
  });
  return r;
}

const phoneBody = z.object({ phone: z.string().max(20) });
const verifyBody = z.object({ phone: z.string().max(20), code: z.string().max(10) });

/** Shopper sign-in with a WhatsApp code. */
export function whatsappAuthRoutes(otp: WhatsAppOtpService, config: Config) {
  const r = Router();
  r.use(noStore);
  const perIp = rateLimit({ windowMs: 15 * 60_000, limit: 30, skip: () => config.env === "test", standardHeaders: "draft-7", legacyHeaders: false, handler: (_q, res) => { res.status(429).json({ error: { code: "rate_limited", message: "Too many attempts from this network. Please wait 15 minutes." } }); } });
  r.get("/status", async (_req, res) => { res.json(await otp.availability()); });
  r.post("/request-otp", perIp, async (req, res) => { res.json(await otp.request(phoneBody.parse(req.body), req.ip)); });
  r.post("/verify-otp", perIp, async (req, res) => {
    const out = await otp.verify(verifyBody.parse(req.body), req);
    setCustomerCookie(res, config, out.session.token, out.session.maxAgeMs);
    res.json({ customer: out.customer, created: out.created });
  });
  return r;
}

/** Bag reminders: checkout progress (with consent) and the reminder link. */
export function cartReminderRoutes(carts: CartRecoveryService, config: Config) {
  const r = Router();
  r.use(noStore);
  const limit = lookupLimiter(config);
  r.post("/started", limit, async (req, res) => { res.json(await carts.started(checkoutStartedSchema.parse(req.body), req.customer?.id ?? null)); });
  r.get("/bag", async (req, res) => { res.json(await carts.bagStatus(req.customer?.id ?? null)); });
  r.post("/bag", limit, async (req, res) => { res.json(await carts.saveBag(bagReminderSchema.parse(req.body), req.customer?.id ?? null)); });
  r.post("/recover", limit, async (req, res) => { res.json(await carts.recover(recoverSchema.parse(req.body).token)); });
  return r;
}

const prefsSchema = z.object({ orderUpdates: z.boolean(), offers: z.boolean() });

/** The signed-in shopper's own WhatsApp choices. */
export function customerWhatsAppRoutes(wa: WhatsAppService, prismaCustomers: { phoneOf(id: string): Promise<string | null> }) {
  const r = Router();
  r.use(noStore, requireCustomer);
  const phoneFor = async (req: Request) => {
    const p = await prismaCustomers.phoneOf(req.customer!.id);
    const w = toWaDigits(p);
    if (!w) throw new HttpError(409, "no_phone", "Add your mobile number to your account first.");
    return w;
  };
  r.get("/", async (req, res) => {
    const phone = await phoneFor(req);
    const [o, m] = await Promise.all([wa.consentOf(phone, CONSENT.orderUpdates), wa.consentOf(phone, CONSENT.marketing)]);
    res.json({ orderUpdates: o === "OPTED_IN", offers: m === "OPTED_IN" });
  });
  r.put("/", async (req, res) => {
    const phone = await phoneFor(req);
    const b = prefsSchema.parse(req.body);
    await wa.setConsent({ phone, purpose: CONSENT.orderUpdates, status: b.orderUpdates ? "OPTED_IN" : "OPTED_OUT", source: "account", customerId: req.customer!.id });
    await wa.setConsent({ phone, purpose: CONSENT.marketing, status: b.offers ? "OPTED_IN" : "OPTED_OUT", source: "account", customerId: req.customer!.id });
    res.json(b);
  });
  return r;
}

const ORDER_PURPOSES = ["order_confirmation", "payment_confirmation", "cod_order_confirmation", "order_packed", "order_shipped", "order_out_for_delivery", "order_delivered", "order_cancelled"] as const satisfies readonly OrderPurpose[];

/** /api/admin/whatsapp — every route checks a permission; the token never appears in any answer. */
export function adminWhatsAppRoutes(deps: { wa: WhatsAppService; admin: WhatsAppAdmin; campaigns: CampaignService; carts: CartRecoveryService; chatbot: Chatbot }) {
  const { wa, admin, campaigns, carts, chatbot } = deps;
  const r = Router();
  r.use(noStore);
  const read = requirePermission("whatsapp.read"), write = requirePermission("whatsapp.write"), approve = requirePermission("whatsapp.approve");

  r.get("/status", read, async (req, res) => { res.json(await wa.status(req.query["refresh"] === "1")); });
  r.get("/templates", read, async (_req, res) => { res.json(await wa.templateOverview()); });
  r.put("/templates", write, async (req, res) => { const map = await wa.saveTemplateMap(req.body); wa.invalidate(); res.json({ map }); });
  r.get("/automations", read, async (_req, res) => { res.json({ automations: await wa.automations() }); });
  r.put("/automations", write, async (req, res) => { res.json({ automations: await wa.saveAutomations(req.body) }); });
  r.get("/chatbot", read, async (_req, res) => { res.json({ chatbot: await chatbot.getSettings() }); });
  r.put("/chatbot", write, async (req, res) => { res.json({ chatbot: await chatbot.saveSettings(req.body) }); });

  r.get("/messages", read, async (req, res) => { res.json(await admin.messages(messageFilterSchema.parse(req.query), canSeePhones(req))); });
  r.get("/errors", read, async (_req, res) => { res.json(await admin.errors()); });
  r.post("/tests", write, async (req, res) => { const b = testSchema.parse(req.body); res.json(await admin.runCheck(b.check, b.recipient)); });

  r.get("/opt-outs", read, async (req, res) => { res.json(await admin.consents(typeof req.query["phone"] === "string" && req.query["phone"] ? req.query["phone"] : undefined, canSeePhones(req))); });
  r.post("/opt-outs", write, async (req, res) => { res.json(await admin.setConsent(consentInputSchema.parse(req.body), actor(req))); });

  r.get("/carts", read, async (req, res) => {
    const q = z.object({ status: z.enum(["OPEN", "CONVERTED", "REMINDED", "SKIPPED", "EXPIRED"]).optional(), page: z.coerce.number().int().min(1).max(1000).default(1) }).parse(req.query);
    res.json(await carts.list(q, canSeePhones(req)));
  });

  r.get("/campaigns", read, async (_req, res) => { res.json(await campaigns.list()); });
  r.post("/campaigns", write, async (req, res) => { res.status(201).json({ campaign: await campaigns.create(campaignInputSchema.parse(req.body), actor(req)) }); });
  r.get("/campaigns/:id", read, async (req, res) => { res.json(await campaigns.detail(idParam(req.params["id"]), canSeePhones(req))); });
  r.patch("/campaigns/:id", write, async (req, res) => { res.json({ campaign: await campaigns.update(idParam(req.params["id"]), campaignInputSchema.parse(req.body), actor(req)) }); });
  r.post("/campaigns/:id/approve", approve, async (req, res) => { res.json({ campaign: await campaigns.approve(idParam(req.params["id"]), approveSchema.parse(req.body).confirmRecipients, actor(req)) }); });
  r.post("/campaigns/:id/cancel", approve, async (req, res) => { res.json({ campaign: await campaigns.cancel(idParam(req.params["id"]), actor(req)) }); });

  r.get("/inbox", read, async (req, res) => { res.json(await admin.inbox(canSeePhones(req))); });
  r.post("/inbox/:id/resolve", write, async (req, res) => { res.json(await admin.resolve(idParam(req.params["id"]), actor(req))); });
  r.post("/inbox/:id/reply", write, async (req, res) => { res.json(await admin.reply(idParam(req.params["id"]), replySchema.parse(req.body).text, actor(req))); });
  return r;
}

/** WhatsApp parts of the admin order screen. */
export function adminOrderWhatsAppRoutes(deps: { admin: WhatsAppAdmin; outForDelivery: (id: string, a: { userId: string; ip?: string | undefined }) => Promise<unknown> }) {
  const r = Router();
  r.use(noStore);
  r.get("/:id/whatsapp", requirePermission("orders.read"), async (req, res) => { res.json(await deps.admin.orderMessages(idParam(req.params["id"]))); });
  r.post("/:id/out-for-delivery", requirePermission("orders.write"), async (req, res) => { res.json({ order: await deps.outForDelivery(idParam(req.params["id"]), actor(req)) }); });
  r.post("/:id/notify", requirePermission("orders.write"), async (req, res) => {
    const b = z.object({ purpose: z.enum(ORDER_PURPOSES) }).parse(req.body);
    res.json(await deps.admin.retryOrderMessage(idParam(req.params["id"]), b.purpose, actor(req)));
  });
  return r;
}
