import { randomUUID } from "node:crypto";

import cors from "cors";
import type { RequestHandler } from "express";
import rateLimit, { type Options } from "express-rate-limit";

import type { Config } from "../config.js";
import { HttpError } from "../errors.js";
import type { Logger } from "../logger.js";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

export const requestId: RequestHandler = (_req, res, next) => {
  res.locals["requestId"] = randomUUID();
  res.setHeader("X-Request-Id", res.locals["requestId"] as string);
  next();
};

export const requestLog = (logger: Logger): RequestHandler => (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info("request", { requestId: res.locals["requestId"], method: req.method, path: req.originalUrl.split("?")[0], status: res.statusCode, ms: Math.round(ms) });
  });
  next();
};

/** Only the store's own website origins may call the API with cookies. */
export const corsPolicy = (config: Config) =>
  cors({
    origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin) ? origin ?? false : false),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    maxAge: 600,
  });

/**
 * Cross-site request forgery protection for cookie-authenticated writes:
 * the Origin (when sent) must be an allowed website, and bodies must be JSON
 * (which browsers can't send cross-site without a CORS preflight we refuse).
 */
export const csrfGuard = (config: Config): RequestHandler => (req, _res, next) => {
  if (SAFE.has(req.method)) return next();
  const origin = req.get("origin");
  if (origin && !config.corsOrigins.includes(origin)) return next(new HttpError(403, "origin_not_allowed", "Requests from this website are not allowed."));
  if (!req.is("application/json")) return next(new HttpError(415, "json_required", "Send the request as JSON."));
  return next();
};

const limitHandler = (message: string): Options["handler"] => (_req, res) => {
  res.status(429).json({ error: { code: "rate_limited", message }, requestId: res.locals["requestId"] });
};

export const apiLimiter = () => rateLimit({ windowMs: 5 * 60_000, limit: 600, standardHeaders: "draft-7", legacyHeaders: false, handler: limitHandler("Too many requests. Please wait a moment and try again.") });

/** Per-IP sign-in limit (the per-account lockout lives in the auth service). */
export const loginLimiter = () =>
  rateLimit({ windowMs: 15 * 60_000, limit: 20, skipSuccessfulRequests: true, standardHeaders: "draft-7", legacyHeaders: false, handler: limitHandler("Too many sign-in attempts from this network. Please wait 15 minutes.") });

/** Per-IP limits for order placement and order look-ups (off in automated tests). */
export const checkoutLimiter = (config: Config) =>
  rateLimit({ windowMs: 15 * 60_000, limit: 40, skip: () => config.env === "test", standardHeaders: "draft-7", legacyHeaders: false, handler: limitHandler("Too many checkout attempts from this network. Please wait a few minutes and try again.") });
export const lookupLimiter = (config: Config) =>
  rateLimit({ windowMs: 5 * 60_000, limit: 300, skip: () => config.env === "test", standardHeaders: "draft-7", legacyHeaders: false, handler: limitHandler("Too many requests. Please wait a moment and try again.") });
