import type { RequestHandler } from "express";

import type { Config } from "../config.js";
import { forbidden, unauthorized } from "../errors.js";
import type { AuthService } from "../services/authService.js";

/** Attaches req.admin when the request carries a valid session cookie. */
export const loadSession = (auth: AuthService, config: Config): RequestHandler => async (req, _res, next) => {
  try {
    const token = (req.cookies as Record<string, string | undefined> | undefined)?.[config.cookie.name];
    const ctx = await auth.authenticate(token);
    if (ctx) req.admin = ctx;
    next();
  } catch (e) {
    next(e);
  }
};

export const requireAdmin: RequestHandler = (req, _res, next) => (req.admin ? next() : next(unauthorized()));

export const requirePermission = (permission: string): RequestHandler => (req, _res, next) => {
  if (!req.admin) return next(unauthorized());
  return req.admin.user.permissions.includes(permission) ? next() : next(forbidden());
};
