import { Router } from "express";
import { z } from "zod";

import type { Config } from "../config.js";
import { badRequest } from "../errors.js";
import {
  addressSchema,
  addressUpdateSchema,
  changePasswordSchema,
  claimOrderSchema,
  customerLoginSchema,
  forgotPasswordSchema,
  profileSchema,
  registerSchema,
  resetPasswordSchema,
  tokenSchema,
} from "../lib/customerSchema.js";
import { clearCustomerCookie, requireCustomer, setCustomerCookie } from "../middleware/customerAuth.js";
import { loginLimiter } from "../middleware/security.js";
import type { CustomerAuthService } from "../services/customerAuthService.js";

/** Path parameters are validated before they reach the database. */
const idParam = (v: unknown) => {
  const p = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).safeParse(v);
  if (!p.success) throw badRequest("Invalid id.");
  return p.data;
};
const orderParam = (v: unknown) => {
  const p = z.string().regex(/^[A-Za-z0-9_-]{6,30}$/).safeParse(v);
  if (!p.success) throw badRequest("That order number isn't valid.");
  return p.data;
};

/**
 * Shopper accounts. Everything here is a shopper action on a shopper cookie — admin rights are never
 * part of this session. State changes are POSTs with JSON bodies so the browser can't be tricked into
 * firing them by a link.
 */
export function customerRoutes(customers: CustomerAuthService, config: Config) {
  const r = Router();
  const authLimit = loginLimiter();

  const send = (res: import("express").Response, out: { customer: unknown; session: { token: string; maxAgeMs: number } }, extra: Record<string, unknown> = {}) => {
    setCustomerCookie(res, config, out.session.token, out.session.maxAgeMs);
    res.setHeader("Cache-Control", "no-store");
    res.json({ customer: out.customer, ...extra });
  };

  r.post("/register", authLimit, async (req, res) => {
    const out = await customers.register(registerSchema.parse(req.body), req);
    send(res, out, { emailConfirmation: out.emailConfirmation });
  });

  r.post("/login", authLimit, async (req, res) => {
    const out = await customers.login(customerLoginSchema.parse(req.body), req);
    send(res, out);
  });

  r.post("/logout", async (req, res) => {
    if (req.customer) await customers.revokeSession(req.customer.sessionId);
    clearCustomerCookie(res, config);
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true });
  });

  r.get("/me", requireCustomer, async (req, res) => {
    const c = await customers.current(req.customer!.id);
    res.setHeader("Cache-Control", "no-store");
    res.json({ customer: c });
  });

  r.patch("/me", requireCustomer, async (req, res) => {
    const out = await customers.updateProfile(req.customer!, profileSchema.parse(req.body));
    res.json(out);
  });

  r.post("/verify-email", async (req, res) => {
    const out = await customers.verifyEmail(tokenSchema.parse(req.body).token);
    res.json(out);
  });

  r.post("/resend-verification", requireCustomer, async (req, res) => {
    res.json(await customers.resendVerification(req.customer!));
  });

  r.post("/forgot-password", authLimit, async (req, res) => {
    res.json(await customers.forgotPassword(forgotPasswordSchema.parse(req.body).email));
  });

  r.post("/reset-password", authLimit, async (req, res) => {
    res.json(await customers.resetPassword(resetPasswordSchema.parse(req.body)));
  });

  r.post("/change-password", requireCustomer, async (req, res) => {
    res.json(await customers.changePassword(req.customer!, changePasswordSchema.parse(req.body)));
  });

  r.post("/sign-out-everywhere", requireCustomer, async (req, res) => {
    await customers.revokeEverySession(req.customer!.id);
    clearCustomerCookie(res, config);
    res.json({ ok: true });
  });

  r.post("/delete-account", requireCustomer, async (req, res) => {
    const out = await customers.deleteAccount(req.customer!);
    clearCustomerCookie(res, config);
    res.json(out);
  });

  r.get("/addresses", requireCustomer, async (req, res) => {
    res.json(await customers.listAddresses(req.customer!));
  });

  r.post("/addresses", requireCustomer, async (req, res) => {
    res.json(await customers.createAddress(req.customer!, addressSchema.parse(req.body)));
  });

  r.patch("/addresses/:id", requireCustomer, async (req, res) => {
    res.json(await customers.updateAddress(req.customer!, idParam(req.params["id"]), addressUpdateSchema.parse(req.body)));
  });

  r.post("/addresses/:id/delete", requireCustomer, async (req, res) => {
    res.json(await customers.deleteAddress(req.customer!, idParam(req.params["id"])));
  });

  r.get("/orders", requireCustomer, async (req, res) => {
    res.json(await customers.listOrders(req.customer!));
  });

  r.get("/orders/:orderNumber", requireCustomer, async (req, res) => {
    res.json(await customers.getOrder(req.customer!, orderParam(req.params["orderNumber"])));
  });

  r.post("/orders/claim", requireCustomer, async (req, res) => {
    res.json(await customers.claimOrder(req.customer!, claimOrderSchema.parse(req.body)));
  });

  return r;
}
