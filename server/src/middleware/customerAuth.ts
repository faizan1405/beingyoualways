import type { CookieOptions, RequestHandler, Response } from "express";

import type { Config } from "../config.js";
import { unauthorized } from "../errors.js";
import type { CustomerAuthService } from "../services/customerAuthService.js";

/**
 * Attaches `req.customer` when the request carries a valid shopper cookie.
 *
 * Shopper sessions live in their own table and their own cookie, so a shopper's cookie can never
 * satisfy `requireAdmin` / `requirePermission` — those only ever read `req.admin`.
 */
export const loadCustomerSession = (customers: CustomerAuthService, config: Config): RequestHandler => async (req, _res, next) => {
  try {
    const token = (req.cookies as Record<string, string | undefined> | undefined)?.[config.customer.cookie];
    if (!token) return next();
    const ctx = await customers.loadSession(token);
    if (ctx) req.customer = ctx;
    next();
  } catch (e) {
    next(e);
  }
};

export const requireCustomer: RequestHandler = (req, _res, next) =>
  req.customer ? next() : next(unauthorized("Please sign in to continue."));

export const customerCookieOptions = (config: Config, maxAge?: number): CookieOptions => ({
  httpOnly: true,
  secure: config.cookie.secure,
  sameSite: config.cookie.sameSite,
  path: "/",
  ...(config.cookie.domain ? { domain: config.cookie.domain } : {}),
  ...(maxAge !== undefined ? { maxAge } : {}),
});

export const setCustomerCookie = (res: Response, config: Config, token: string, maxAgeMs: number) =>
  res.cookie(config.customer.cookie, token, customerCookieOptions(config, maxAgeMs));

export const clearCustomerCookie = (res: Response, config: Config) => res.clearCookie(config.customer.cookie, customerCookieOptions(config));
