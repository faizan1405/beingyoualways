import express, { Router, type Request } from "express";
import { z } from "zod";

import type { Config } from "../config.js";
import { badRequest } from "../errors.js";
import { orderAccessSchema, paymentProblemSchema, placeOrderSchema, quoteSchema, razorpayResultSchema } from "../lib/checkoutSchema.js";
import { requirePermission } from "../middleware/auth.js";
import { checkoutLimiter, lookupLimiter } from "../middleware/security.js";
import { customerFilterSchema, customerUpdateSchema, type createAdminCustomerService } from "../services/adminCustomerService.js";
import { cancelSchema, codCollectSchema, noteSchema, orderFilterSchema, shipmentSchema, statusChangeSchema, type AdminOrderService } from "../services/adminOrderService.js";
import type { CheckoutService } from "../services/checkoutService.js";
import { dashboardQuerySchema, type createDashboardService } from "../services/dashboardService.js";
import { discountInputSchema, type createDiscountService } from "../services/discountService.js";
import type { SettingsService } from "../services/settingsService.js";

const idParam = (v: unknown) => { const p = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).safeParse(v); if (!p.success) throw badRequest("Invalid id."); return p.data; };
const actor = (req: Request) => ({ userId: req.admin!.user.id, ip: req.ip });
const noStore: express.RequestHandler = (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); };

/** Public shop endpoints. Totals are always recalculated on the server. */
export function checkoutRoutes(checkout: CheckoutService, settings: SettingsService, config: Config) {
  const r = Router();
  r.use(noStore);
  const lookup = lookupLimiter(config);
  const place = checkoutLimiter(config);
  r.get("/config", async (_req, res) => { res.json(await settings.publicConfig()); });
  r.post("/cart", lookup, async (req, res) => { res.json(await checkout.quote(quoteSchema.parse(req.body))); });
  r.post("/quote", lookup, async (req, res) => { res.json(await checkout.quote(quoteSchema.parse(req.body))); });
  r.post("/orders", place, async (req, res) => {
    const out = await checkout.placeOrder(placeOrderSchema.parse(req.body));
    res.status(out.duplicate ? 200 : 201).json(out);
  });
  r.post("/orders/lookup", lookup, async (req, res) => { const a = orderAccessSchema.parse(req.body); res.json(await checkout.lookup(a.orderNumber, a.token)); });
  r.post("/orders/retry-payment", place, async (req, res) => { const a = orderAccessSchema.parse(req.body); res.json(await checkout.retryPayment(a.orderNumber, a.token)); });
  r.post("/razorpay/verify", place, async (req, res) => { const b = razorpayResultSchema.parse(req.body); res.json(await checkout.verifyPayment({ ...b, token: b.token })); });
  r.post("/razorpay/problem", lookup, async (req, res) => { const b = paymentProblemSchema.parse(req.body); res.json(await checkout.reportProblem(b)); });
  return r;
}

/** Razorpay webhooks need the exact raw body for the signature check, so this router is mounted before the JSON parser. */
export function webhookRoutes(checkout: CheckoutService) {
  const r = Router();
  r.post("/razorpay", express.raw({ type: "*/*", limit: "512kb" }), async (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    res.json(await checkout.handleWebhook(raw, req.get("x-razorpay-signature"), req.get("x-razorpay-event-id")));
  });
  return r;
}

export function adminCommerceRoutes(deps: {
  orders: AdminOrderService; checkout: CheckoutService; settings: SettingsService;
  customers: ReturnType<typeof createAdminCustomerService>; dashboard: ReturnType<typeof createDashboardService>; discounts: ReturnType<typeof createDiscountService>;
}) {
  const { orders, checkout, settings, customers, dashboard, discounts } = deps;
  const r = Router();
  r.use(noStore);

  r.get("/dashboard", requirePermission("orders.read"), async (req, res) => { res.json(await dashboard.summary(dashboardQuerySchema.parse(req.query))); });

  r.get("/orders", requirePermission("orders.read"), async (req, res) => { res.json(await orders.list(orderFilterSchema.parse(req.query))); });
  r.get("/orders/export.csv", requirePermission("orders.read"), async (req, res) => {
    const csv = await orders.csv(orderFilterSchema.parse(req.query));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(`\uFEFF${csv}`);
  });
  r.get("/orders/:id", requirePermission("orders.read"), async (req, res) => { res.json({ order: await orders.detail(idParam(req.params["id"])) }); });
  r.post("/orders/:id/status", requirePermission("orders.write"), async (req, res) => { res.json({ order: await orders.changeStatus(idParam(req.params["id"]), statusChangeSchema.parse(req.body), actor(req)) }); });
  r.post("/orders/:id/notes", requirePermission("orders.write"), async (req, res) => { res.json({ order: await orders.addNote(idParam(req.params["id"]), noteSchema.parse(req.body).text, actor(req)) }); });
  r.post("/orders/:id/shipment", requirePermission("orders.write"), async (req, res) => { res.json({ order: await orders.setShipment(idParam(req.params["id"]), shipmentSchema.parse(req.body), actor(req)) }); });
  r.post("/orders/:id/cancel", requirePermission("orders.cancel"), async (req, res) => { res.json({ order: await orders.cancel(idParam(req.params["id"]), cancelSchema.parse(req.body).reason, actor(req)) }); });
  r.post("/orders/:id/cod-collected", requirePermission("payments.record"), async (req, res) => { res.json({ order: await orders.recordCodCollection(idParam(req.params["id"]), codCollectSchema.parse(req.body), actor(req)) }); });
  r.post("/payments/reconcile", requirePermission("orders.write"), async (_req, res) => { res.json(await checkout.reconcileAll()); });

  r.get("/customers", requirePermission("customers.read"), async (req, res) => { res.json(await customers.list(customerFilterSchema.parse(req.query))); });
  r.get("/customers/:id", requirePermission("customers.read"), async (req, res) => { res.json({ customer: await customers.detail(idParam(req.params["id"])) }); });
  r.patch("/customers/:id", requirePermission("customers.write"), async (req, res) => { res.json({ customer: await customers.update(idParam(req.params["id"]), customerUpdateSchema.parse(req.body), actor(req)) }); });

  r.get("/discounts", requirePermission("orders.read"), async (_req, res) => { res.json({ discounts: await discounts.list() }); });
  r.post("/discounts", requirePermission("discounts.write"), async (req, res) => { res.status(201).json({ discount: await discounts.create(discountInputSchema.parse(req.body), actor(req)) }); });
  r.patch("/discounts/:id", requirePermission("discounts.write"), async (req, res) => { res.json({ discount: await discounts.update(idParam(req.params["id"]), discountInputSchema.parse(req.body), actor(req)) }); });
  r.delete("/discounts/:id", requirePermission("discounts.write"), async (req, res) => { res.json(await discounts.remove(idParam(req.params["id"]), actor(req))); });

  r.get("/settings", requirePermission("orders.read"), async (_req, res) => { res.json(await settings.all()); });
  r.put("/settings/:kind", requirePermission("settings.write"), async (req, res) => {
    const kind = z.enum(["shipping", "cod", "store"]).safeParse(req.params["kind"]);
    if (!kind.success) throw badRequest("Unknown settings section.");
    res.json(await settings.save(kind.data, req.body, actor(req)));
  });
  return r;
}
