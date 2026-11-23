import { randomBytes } from "node:crypto";

import { z } from "zod";

const bool = z.enum(["true", "false", "1", "0"]).transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().regex(/^mysql:\/\//, "must be a mysql:// connection URL"),
  CORS_ORIGINS: z.string().default(""),
  COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default("bya_admin_session"),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
  COOKIE_SECURE: bool.optional(),
  SESSION_TTL_HOURS: z.coerce.number().min(1).max(24 * 30).default(12),
  SESSION_IDLE_MINUTES: z.coerce.number().min(5).max(24 * 60).default(120),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().min(1).max(24 * 60).default(15),
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(1),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]).default("info"),
  // Razorpay — test keys (rzp_test_…) outside production; live keys (rzp_live_…) only with NODE_ENV=production.
  RAZORPAY_KEY_ID: z.string().trim().regex(/^rzp_(test|live)_[A-Za-z0-9]+$/, "must look like rzp_test_… or rzp_live_…").optional().or(z.literal("")),
  RAZORPAY_KEY_SECRET: z.string().trim().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().trim().optional(),
  /** Minutes an unpaid online order holds its stock before it is released. */
  PAYMENT_HOLD_MINUTES: z.coerce.number().int().min(5).max(120).default(30),
  /** Signs the private order-status links given to shoppers (32+ random characters). */
  ORDER_LINK_SECRET: z.string().optional(),
  /** Staging/test database: every new order is flagged as a test order and never counted as a sale. */
  STORE_TEST_MODE: bool.optional(),
  // ── Phase 3: customer accounts (separate cookie from the admin session) ──
  CUSTOMER_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default("bya_customer_session"),
  CUSTOMER_SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(180).default(30),
  CUSTOMER_SESSION_IDLE_DAYS: z.coerce.number().int().min(1).max(90).default(14),
  /** Where verification / recovery links point. */
  PUBLIC_SITE_URL: z.string().url().default("http://localhost:8080"),
  GOOGLE_CLIENT_ID: z.string().trim().optional(),
  GOOGLE_CLIENT_SECRET: z.string().trim().optional(),
  GOOGLE_REDIRECT_URL: z.string().trim().optional(),
  // ── Phase 3: media (files on the server disk, metadata in MySQL) ──
  MEDIA_ROOT: z.string().trim().default("./media"),
  MEDIA_MAX_IMAGE_BYTES: z.coerce.number().int().min(10_240).default(8 * 1024 * 1024),
  MEDIA_MAX_VIDEO_BYTES: z.coerce.number().int().min(10_240).default(80 * 1024 * 1024),
  // ── Phase 3: email ──
  /** "outbox" writes the message to the media folder instead of sending it, so nothing is faked. */
  MAIL_TRANSPORT: z.enum(["outbox", "smtp"]).default("outbox"),
  SMTP_HOST: z.string().trim().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().trim().optional(),
  SMTP_PASSWORD: z.string().trim().optional(),
  MAIL_FROM: z.string().trim().default("Being You – Always <no-reply@beingyoualways.com>"),
});

export interface Config {
  env: "development" | "test" | "production";
  port: number;
  databaseUrl: string;
  corsOrigins: string[];
  cookie: { name: string; domain: string | undefined; sameSite: "lax" | "strict" | "none"; secure: boolean };
  session: { ttlMs: number; idleMs: number };
  login: { maxAttempts: number; lockMs: number };
  trustProxy: number;
  logLevel: "debug" | "info" | "warn" | "error" | "silent";
  razorpay: { keyId: string; keySecret: string; webhookSecret: string; mode: "test" | "live" } | null;
  paymentHoldMs: number;
  orderLinkSecret: string;
  storeTestMode: boolean;
  customer: { cookie: string; ttlMs: number; idleMs: number };
  publicSiteUrl: string;
  /** null until all three Google credentials are present — sign-in with Google stays off until then. */
  google: { clientId: string; clientSecret: string; redirectUrl: string } | null;
  media: { root: string; maxImageBytes: number; maxVideoBytes: number };
  /** null when SMTP isn't configured: mail then goes to the outbox folder, never to a fake "sent". */
  mail: { transport: "outbox" | "smtp"; host: string; port: number; user: string; password: string; from: string } | null;
  /** the address shown on every message the store sends */
  mailFrom: string;
}

export class ConfigError extends Error {}

/** Reads and validates environment variables. Error messages name variables, never their values. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new ConfigError(`Invalid server configuration — ${problems}`);
  }
  const e = parsed.data;
  const corsOrigins = e.CORS_ORIGINS.split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
  for (const o of corsOrigins) {
    if (!/^https?:\/\/[^/\s]+$/.test(o)) throw new ConfigError(`Invalid server configuration — CORS_ORIGINS entry is not an origin: ${o}`);
  }
  if (e.NODE_ENV === "production") {
    if (corsOrigins.length === 0) throw new ConfigError("Invalid server configuration — CORS_ORIGINS is required in production");
    if (corsOrigins.some((o) => o.startsWith("http://"))) throw new ConfigError("Invalid server configuration — CORS_ORIGINS must use https in production");
  }
  const secure = e.COOKIE_SECURE ?? e.NODE_ENV === "production";
  if (e.COOKIE_SAMESITE === "none" && !secure) throw new ConfigError("Invalid server configuration — COOKIE_SAMESITE=none requires secure cookies");
  let razorpay: Config["razorpay"] = null;
  if (e.RAZORPAY_KEY_ID) {
    if (!e.RAZORPAY_KEY_SECRET) throw new ConfigError("Invalid server configuration — RAZORPAY_KEY_SECRET is required with RAZORPAY_KEY_ID");
    if (!e.RAZORPAY_WEBHOOK_SECRET) throw new ConfigError("Invalid server configuration — RAZORPAY_WEBHOOK_SECRET is required with RAZORPAY_KEY_ID");
    const mode = e.RAZORPAY_KEY_ID.startsWith("rzp_live_") ? "live" : "test";
    if (mode === "live" && e.NODE_ENV !== "production") throw new ConfigError("Invalid server configuration — live Razorpay keys are only allowed with NODE_ENV=production; use rzp_test_ keys here");
    if (mode === "live" && e.STORE_TEST_MODE) throw new ConfigError("Invalid server configuration — STORE_TEST_MODE can't be used with live Razorpay keys");
    razorpay = { keyId: e.RAZORPAY_KEY_ID, keySecret: e.RAZORPAY_KEY_SECRET, webhookSecret: e.RAZORPAY_WEBHOOK_SECRET, mode };
  } else if (e.RAZORPAY_KEY_SECRET || e.RAZORPAY_WEBHOOK_SECRET) {
    throw new ConfigError("Invalid server configuration — RAZORPAY_KEY_ID is missing");
  }
  let orderLinkSecret = e.ORDER_LINK_SECRET?.trim() ?? "";
  if (orderLinkSecret && orderLinkSecret.length < 32) throw new ConfigError("Invalid server configuration — ORDER_LINK_SECRET must be at least 32 characters");
  if (!orderLinkSecret) {
    if (e.NODE_ENV === "production") throw new ConfigError("Invalid server configuration — ORDER_LINK_SECRET is required in production");
    orderLinkSecret = randomBytes(32).toString("hex"); // development only: order links stop working after a restart
  }
  // Google sign-in is all-or-nothing: half-configured credentials would leave a broken button on the site.
  const googleId = e.GOOGLE_CLIENT_ID?.trim() ?? "";
  const googleSecret = e.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  const googleRedirect = e.GOOGLE_REDIRECT_URL?.trim() ?? "";
  const googleParts = [googleId, googleSecret, googleRedirect].filter(Boolean).length;
  if (googleParts > 0 && googleParts < 3) {
    throw new ConfigError("Invalid server configuration — GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URL must all be set to enable sign-in with Google");
  }
  const google = googleParts === 3 ? { clientId: googleId, clientSecret: googleSecret, redirectUrl: googleRedirect } : null;
  if (google && e.NODE_ENV === "production" && !google.redirectUrl.startsWith("https://")) {
    throw new ConfigError("Invalid server configuration — GOOGLE_REDIRECT_URL must use https in production");
  }
  // SMTP is optional. Without it, messages are written to the outbox folder instead of being sent.
  let mail: Config["mail"] = null;
  if (e.MAIL_TRANSPORT === "smtp") {
    const host = e.SMTP_HOST?.trim() ?? "", user = e.SMTP_USER?.trim() ?? "", password = e.SMTP_PASSWORD?.trim() ?? "";
    if (!host || !user || !password) throw new ConfigError("Invalid server configuration — MAIL_TRANSPORT=smtp requires SMTP_HOST, SMTP_USER and SMTP_PASSWORD");
    mail = { transport: "smtp", host, port: e.SMTP_PORT, user, password, from: e.MAIL_FROM };
  }
  return {
    env: e.NODE_ENV,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    corsOrigins,
    cookie: { name: e.COOKIE_NAME, domain: e.COOKIE_DOMAIN?.trim() || undefined, sameSite: e.COOKIE_SAMESITE, secure },
    session: { ttlMs: e.SESSION_TTL_HOURS * 3_600_000, idleMs: e.SESSION_IDLE_MINUTES * 60_000 },
    login: { maxAttempts: e.LOGIN_MAX_ATTEMPTS, lockMs: e.LOGIN_LOCK_MINUTES * 60_000 },
    trustProxy: e.TRUST_PROXY,
    logLevel: e.LOG_LEVEL,
    razorpay,
    paymentHoldMs: e.PAYMENT_HOLD_MINUTES * 60_000,
    orderLinkSecret,
    storeTestMode: e.STORE_TEST_MODE ?? false,
    customer: {
      cookie: e.CUSTOMER_COOKIE_NAME,
      ttlMs: e.CUSTOMER_SESSION_TTL_DAYS * 86_400_000,
      idleMs: e.CUSTOMER_SESSION_IDLE_DAYS * 86_400_000,
    },
    publicSiteUrl: e.PUBLIC_SITE_URL.replace(/\/$/, ""),
    google,
    media: { root: e.MEDIA_ROOT, maxImageBytes: e.MEDIA_MAX_IMAGE_BYTES, maxVideoBytes: e.MEDIA_MAX_VIDEO_BYTES },
    mail,
    mailFrom: e.MAIL_FROM,
  };
}
