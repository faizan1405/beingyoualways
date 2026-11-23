import type { Customer, PrismaClient } from "@prisma/client";
import type { Request } from "express";

import type { Config } from "../config.js";
import { badRequest, conflict, forbidden, HttpError, notFound, unauthorized } from "../errors.js";
import type {
  AddressInput,
  AddressUpdate,
  ChangePasswordInput,
  ClaimOrderInput,
  CustomerLoginInput,
  ProfileInput,
  RegisterInput,
  ResetPasswordInput,
} from "../lib/customerSchema.js";
import { logActivity } from "./activity.js";
import { checkOrderToken } from "./orderLinks.js";
import type { Mailer } from "./mailer.js";
import { accountDeletedTemplate, passwordChangedTemplate, passwordResetTemplate, verifyEmailTemplate } from "./emailTemplates.js";
import { dummyHash, hashPassword, needsRehash, passwordProblem, verifyPassword } from "./password.js";
import { hashToken, newToken } from "./tokens.js";
import { orderInclude, publicOrder, type OrderRow } from "./orderShared.js";

/** What a signed-in shopper's cookie proves. Never carries admin rights — customers have no roles. */
export interface CustomerContext {
  id: string;
  email: string | null;
  name: string;
  emailVerified: boolean;
  sessionId: string;
}

const MIN_PASSWORD = 10;
const VERIFY_HOURS = 24;
const RESET_MINUTES = 45;

export function createCustomerAuthService(prisma: PrismaClient, config: Config, mailer: Mailer) {
  const now = () => new Date();

  const view = (c: Customer) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    emailVerified: Boolean(c.emailVerifiedAt),
    status: c.status,
    signInMethod: c.signInMethod,
    googleLinked: Boolean(c.googleSub),
    hasPassword: Boolean(c.passwordHash),
    createdAt: c.createdAt.toISOString(),
    lastLoginAt: c.lastLoginAt?.toISOString() ?? null,
  });

  // ── sessions ────────────────────────────────────────────────────────────────

  async function openSession(customerId: string, req: Request) {
    const token = newToken();
    const at = now();
    const s = await prisma.customerSession.create({
      data: {
        tokenHash: hashToken(token),
        customerId,
        expiresAt: new Date(at.getTime() + config.customer.ttlMs),
        ip: req.ip?.slice(0, 64) ?? null,
        userAgent: req.get("user-agent")?.slice(0, 255) ?? null,
      },
    });
    return { token, sessionId: s.id, maxAgeMs: config.customer.ttlMs };
  }

  /** Reads a customer cookie. Returns null for anything expired, idle, revoked or deleted. */
  async function loadSession(token: string): Promise<CustomerContext | null> {
    if (!token) return null;
    const s = await prisma.customerSession.findUnique({ where: { tokenHash: hashToken(token) }, include: { customer: true } });
    if (!s || s.revokedAt) return null;
    const at = now();
    if (s.expiresAt < at || s.lastSeenAt.getTime() + config.customer.idleMs < at.getTime()) return null;
    const c = s.customer;
    if (c.deletedAt || c.status === "BLOCKED") return null;
    // slide the idle window, but only write when it has drifted by more than a minute
    if (at.getTime() - s.lastSeenAt.getTime() > 60_000) {
      await prisma.customerSession.update({ where: { id: s.id }, data: { lastSeenAt: at } });
    }
    return { id: c.id, email: c.email, name: c.name, emailVerified: Boolean(c.emailVerifiedAt), sessionId: s.id };
  }

  async function revokeSession(sessionId: string) {
    await prisma.customerSession.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: now() } });
  }

  async function revokeEverySession(customerId: string, exceptSessionId?: string) {
    await prisma.customerSession.updateMany({
      where: { customerId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      data: { revokedAt: now() },
    });
  }

  // ── single-use tokens ───────────────────────────────────────────────────────

  /**
   * Security notices (password changed, account deleted). The account change has already happened, so a
   * mail problem must not undo it or show the shopper an error — it is logged by the mailer instead.
   */
  async function notify(to: string, content: { subject: string; text: string; html: string }) {
    try {
      await mailer.send({ to, ...content });
    } catch {
      // outbox write failed (disk); the change itself stands
    }
  }

  async function issueToken(customerId: string, purpose: "VERIFY_EMAIL" | "RESET_PASSWORD", target: string | null, ttlMs: number) {
    const token = newToken();
    await prisma.customerToken.create({
      data: { tokenHash: hashToken(token), customerId, purpose, target, expiresAt: new Date(now().getTime() + ttlMs) },
    });
    return token;
  }

  /** Consumes a token: one use only, and a wrong/expired one never says which part failed. */
  async function consumeToken(token: string, purpose: "VERIFY_EMAIL" | "RESET_PASSWORD") {
    const row = await prisma.customerToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt < now()) {
      throw badRequest("That link is no longer valid. Please ask for a new one.");
    }
    // only one request can claim the link, even if two arrive at the same moment
    const claimed = await prisma.customerToken.updateMany({ where: { id: row.id, usedAt: null, expiresAt: { gte: now() } }, data: { usedAt: now() } });
    if (claimed.count !== 1) throw badRequest("That link is no longer valid. Please ask for a new one.");
    return row;
  }

  // ── registration ────────────────────────────────────────────────────────────

  async function register(input: RegisterInput, req: Request) {
    const problem = passwordProblem(input.password, input.email, MIN_PASSWORD);
    if (problem) throw badRequest(problem);

    const taken = await prisma.customer.findUnique({ where: { email: input.email }, select: { id: true, passwordHash: true, name: true, email: true, deletedAt: true } });
    if (taken?.passwordHash) throw conflict("An account with this email already exists. Sign in instead, or use Forgotten password.");
    if (taken && !taken.deletedAt && taken.email) {
      // This email already has orders (checkout) or a Google sign-in. Typing the address proves nothing, so the
      // password is never attached here and no session opens: the owner gets a link at that address instead.
      const token = await issueToken(taken.id, "RESET_PASSWORD", taken.email, RESET_MINUTES * 60_000);
      const link = `${config.publicSiteUrl}/reset-password?token=${token}`;
      await mailer.send({ to: taken.email, ...passwordResetTemplate({ name: taken.name, link, minutes: RESET_MINUTES }) });
      await logActivity(prisma, null, { action: "customer.registerExisting", entityType: "customer", entityId: taken.id, summary: "Sign-up with an email that already had orders — a set-password link was emailed" });
      return { setupLinkSent: true as const };
    }
    if (input.phone) {
      const phoneTaken = await prisma.customer.findUnique({ where: { phone: input.phone }, select: { id: true } });
      if (phoneTaken) throw conflict("That mobile number is already used by another account.");
    }

    const customer = await prisma.customer.create({
          data: {
            name: input.name,
            email: input.email,
            phone: input.phone ?? null,
            passwordHash: await hashPassword(input.password),
            signInMethod: "password",
          },
        });

    const verifyToken = await issueToken(customer.id, "VERIFY_EMAIL", customer.email, VERIFY_HOURS * 3_600_000);
    const link = `${config.publicSiteUrl}/verify-email?token=${verifyToken}`;
    const mail = await mailer.send({ to: customer.email!, ...verifyEmailTemplate({ name: customer.name, link, hours: VERIFY_HOURS }) });

    const session = await openSession(customer.id, req);
    await logActivity(prisma, null, { action: "customer.register", entityType: "customer", entityId: customer.id, summary: `Account created for ${customer.email}` });
    return { setupLinkSent: false as const, customer: view(customer), session, emailConfirmation: mail.delivered ? "sent" : "queued" };
  }

  // ── sign in ─────────────────────────────────────────────────────────────────

  async function login(input: CustomerLoginInput, req: Request) {
    const c = await prisma.customer.findUnique({ where: { email: input.email } });
    const at = now();
    // Unknown email and unknown password answer the same way, in the same time.
    if (!c || !c.passwordHash || c.deletedAt) {
      await verifyPassword(await dummyHash(), input.password);
      throw unauthorized("We couldn't find an account with that email and password.");
    }
    if (c.lockedUntil && c.lockedUntil > at) {
      throw new HttpError(429, "too_many_attempts", "Too many attempts. Please try again in a few minutes.");
    }
    const ok = await verifyPassword(c.passwordHash, input.password);
    if (!ok) {
      const fails = c.failedLoginCount + 1;
      const lock = fails >= config.login.maxAttempts;
      await prisma.customer.update({
        where: { id: c.id },
        data: { failedLoginCount: lock ? 0 : fails, lockedUntil: lock ? new Date(at.getTime() + config.login.lockMs) : null },
      });
      throw unauthorized("We couldn't find an account with that email and password.");
    }
    if (c.status === "BLOCKED") throw forbidden("This account can't sign in right now. Please contact the store.");

    await prisma.customer.update({
      where: { id: c.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: at, ...(needsRehash(c.passwordHash) ? { passwordHash: await hashPassword(input.password) } : {}) },
    });
    const session = await openSession(c.id, req);
    return { customer: view(c), session };
  }

  // ── email confirmation ──────────────────────────────────────────────────────

  async function verifyEmail(token: string) {
    const row = await consumeToken(token, "VERIFY_EMAIL");
    const c = await prisma.customer.update({ where: { id: row.customerId }, data: { emailVerifiedAt: now() } });
    await logActivity(prisma, null, { action: "customer.emailVerified", entityType: "customer", entityId: c.id, summary: `Email confirmed for ${c.email}` });
    return { customer: view(c) };
  }

  async function resendVerification(ctx: CustomerContext) {
    const c = await prisma.customer.findUnique({ where: { id: ctx.id } });
    if (!c?.email) throw badRequest("Add an email address first.");
    if (c.emailVerifiedAt) return { emailConfirmation: "already-confirmed" as const };
    const token = await issueToken(c.id, "VERIFY_EMAIL", c.email, VERIFY_HOURS * 3_600_000);
    const link = `${config.publicSiteUrl}/verify-email?token=${token}`;
    const mail = await mailer.send({ to: c.email, ...verifyEmailTemplate({ name: c.name, link, hours: VERIFY_HOURS }) });
    return { emailConfirmation: mail.delivered ? ("sent" as const) : ("queued" as const) };
  }

  // ── password recovery ───────────────────────────────────────────────────────

  /** Always answers the same way, whether or not the address is with us. */
  async function forgotPassword(email: string) {
    const c = await prisma.customer.findUnique({ where: { email } });
    if (c && !c.deletedAt && c.email) {
      const token = await issueToken(c.id, "RESET_PASSWORD", c.email, RESET_MINUTES * 60_000);
      const link = `${config.publicSiteUrl}/reset-password?token=${token}`;
      await mailer.send({ to: c.email, ...passwordResetTemplate({ name: c.name, link, minutes: RESET_MINUTES }) });
    }
    return { accepted: true };
  }

  async function resetPassword(input: ResetPasswordInput) {
    const problem = passwordProblem(input.password, undefined, MIN_PASSWORD);
    if (problem) throw badRequest(problem);
    const row = await consumeToken(input.token, "RESET_PASSWORD");
    const before = await prisma.customer.findUnique({ where: { id: row.customerId }, select: { email: true, emailVerifiedAt: true, signInMethod: true } });
    // the link reached this inbox, which proves the address — so it counts as confirmed
    const provedEmail = !!before?.email && before.email === row.target && !before.emailVerifiedAt;
    const c = await prisma.customer.update({
      where: { id: row.customerId },
      data: {
        passwordHash: await hashPassword(input.password), passwordChangedAt: now(), failedLoginCount: 0, lockedUntil: null,
        ...(provedEmail ? { emailVerifiedAt: now() } : {}),
        ...(before && !before.signInMethod ? { signInMethod: "password" } : {}),
      },
    });
    // a reset signs every other device out
    await revokeEverySession(c.id);
    if (c.email) await notify(c.email, passwordChangedTemplate({ name: c.name, signInUrl: `${config.publicSiteUrl}/login`, how: "reset" }));
    await logActivity(prisma, null, { action: "customer.passwordReset", entityType: "customer", entityId: c.id, summary: `Password reset for ${c.email}` });
    return { customer: view(c) };
  }

  async function changePassword(ctx: CustomerContext, input: ChangePasswordInput) {
    const c = await prisma.customer.findUnique({ where: { id: ctx.id } });
    if (!c?.passwordHash) throw badRequest("This account doesn't have a password yet.");
    if (!(await verifyPassword(c.passwordHash, input.currentPassword))) throw unauthorized("Your current password isn't right.");
    const problem = passwordProblem(input.password, c.email ?? undefined, MIN_PASSWORD);
    if (problem) throw badRequest(problem);
    await prisma.customer.update({
      where: { id: c.id },
      data: { passwordHash: await hashPassword(input.password), passwordChangedAt: now() },
    });
    await revokeEverySession(c.id, ctx.sessionId);
    if (c.email) await notify(c.email, passwordChangedTemplate({ name: c.name, signInUrl: `${config.publicSiteUrl}/login`, how: "changed" }));
    return { changed: true };
  }

  // ── profile, addresses, orders ──────────────────────────────────────────────

  async function updateProfile(ctx: CustomerContext, input: ProfileInput) {
    const current = await prisma.customer.findUnique({ where: { id: ctx.id }, select: { phone: true } });
    if (input.phone) {
      const other = await prisma.customer.findUnique({ where: { phone: input.phone }, select: { id: true } });
      if (other && other.id !== ctx.id) throw conflict("That mobile number is already used by another account.");
    }
    const c = await prisma.customer.update({
      where: { id: ctx.id },
      data: {
        name: input.name,
        // a new number has not been proved yet; WhatsApp sign-in proves it again
        ...(input.phone !== undefined ? { phone: input.phone, ...(input.phone !== current?.phone ? { phoneVerifiedAt: null } : {}) } : {}),
      },
    });
    return { customer: view(c) };
  }

  const addressView = (a: { id: string; label: string; name: string; phone: string; line1: string; line2: string | null; city: string; state: string; pincode: string; isDefault: boolean }) => ({
    id: a.id, label: a.label, name: a.name, phone: a.phone, line1: a.line1, line2: a.line2, city: a.city, state: a.state, pincode: a.pincode, isDefault: a.isDefault,
  });

  async function listAddresses(ctx: CustomerContext) {
    const rows = await prisma.shippingAddress.findMany({ where: { customerId: ctx.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
    return { addresses: rows.map(addressView) };
  }

  async function createAddress(ctx: CustomerContext, input: AddressInput) {
    const first = (await prisma.shippingAddress.count({ where: { customerId: ctx.id } })) === 0;
    const makeDefault = input.isDefault || first;
    const a = await prisma.$transaction(async (tx) => {
      if (makeDefault) await tx.shippingAddress.updateMany({ where: { customerId: ctx.id }, data: { isDefault: false } });
      return tx.shippingAddress.create({ data: { customerId: ctx.id, label: input.label, name: input.name, phone: input.phone, line1: input.line1, line2: input.line2 || null, city: input.city, state: input.state, pincode: input.pincode, isDefault: makeDefault } });
    });
    return { address: addressView(a) };
  }

  async function updateAddress(ctx: CustomerContext, id: string, input: AddressUpdate) {
    const existing = await prisma.shippingAddress.findFirst({ where: { id, customerId: ctx.id } });
    if (!existing) throw notFound("That address isn't in your account.");
    const a = await prisma.$transaction(async (tx) => {
      if (input.isDefault) await tx.shippingAddress.updateMany({ where: { customerId: ctx.id }, data: { isDefault: false } });
      return tx.shippingAddress.update({
        where: { id },
        data: {
          ...(input.label !== undefined ? { label: input.label } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.line1 !== undefined ? { line1: input.line1 } : {}),
          ...(input.line2 !== undefined ? { line2: input.line2 || null } : {}),
          ...(input.city !== undefined ? { city: input.city } : {}),
          ...(input.state !== undefined ? { state: input.state } : {}),
          ...(input.pincode !== undefined ? { pincode: input.pincode } : {}),
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        },
      });
    });
    return { address: addressView(a) };
  }

  async function deleteAddress(ctx: CustomerContext, id: string) {
    const existing = await prisma.shippingAddress.findFirst({ where: { id, customerId: ctx.id } });
    if (!existing) throw notFound("That address isn't in your account.");
    if (await prisma.order.count({ where: { shippingAddressId: id } })) {
      throw conflict("This address was used for an order, so it stays with that order. Add a new one instead.");
    }
    await prisma.shippingAddress.delete({ where: { id } });
    return { deleted: true };
  }

  const orderView = (o: OrderRow) => publicOrder(o);

  async function listOrders(ctx: CustomerContext) {
    const rows = await prisma.order.findMany({ where: { customerId: ctx.id }, orderBy: { createdAt: "desc" }, include: orderInclude });
    return { orders: rows.map(orderView) };
  }

  async function getOrder(ctx: CustomerContext, orderNumber: string) {
    const o = await prisma.order.findFirst({ where: { orderNumber, customerId: ctx.id }, include: orderInclude });
    if (!o) throw notFound("We couldn't find that order in your account.");
    return { order: orderView(o) };
  }

  /**
   * Brings an earlier order into the account. The private link's key must match (the same proof the
   * order page itself uses), and the order must already carry this account's email or mobile — a
   * leaked link alone can't move an order that belongs to an account which can sign in.
   */
  async function claimOrder(ctx: CustomerContext, input: ClaimOrderInput) {
    if (!checkOrderToken(config.orderLinkSecret, input.orderNumber, input.token)) {
      throw notFound("We couldn't verify that order. Check the link from your confirmation page.");
    }
    const o = await prisma.order.findFirst({ where: { orderNumber: input.orderNumber }, include: orderInclude });
    if (!o) throw notFound("We couldn't verify that order. Check the link from your confirmation page.");
    const c = await prisma.customer.findUnique({ where: { id: ctx.id } });
    const matches = Boolean(c && ((c.email && o.email === c.email) || (c.phone && o.phone === c.phone)));
    if (!matches) throw forbidden("This order belongs to different contact details, so it can't be added to this account.");
    const owner = o.customerId ? await prisma.customer.findUnique({ where: { id: o.customerId }, select: { passwordHash: true } }) : null;
    if (owner?.passwordHash && o.customerId !== ctx.id) throw conflict("This order is already in another account.");
    await prisma.order.update({ where: { id: o.id }, data: { customerId: ctx.id } });
    await logActivity(prisma, null, { action: "order.claim", entityType: "order", entityId: o.id, summary: `Order ${o.orderNumber} was added to a shopper account` });
    const after = await prisma.order.findUnique({ where: { id: o.id }, include: orderInclude });
    return { order: orderView(after!) };
  }

  // ── account removal ─────────────────────────────────────────────────────────

  /**
   * Personal data is removed; the order rows stay because the store must keep its own sales record.
   * The customer row is emptied and marked, so nothing can sign back in with it.
   */
  async function deleteAccount(ctx: CustomerContext) {
    // read the address before it is erased, so the confirmation can still reach the shopper
    const before = await prisma.customer.findUnique({ where: { id: ctx.id }, select: { email: true, name: true } });
    await prisma.$transaction(async (tx) => {
      await tx.customerSession.updateMany({ where: { customerId: ctx.id, revokedAt: null }, data: { revokedAt: now() } });
      // saved addresses that no order depends on go first
      await tx.shippingAddress.deleteMany({ where: { customerId: ctx.id, orders: { none: {} } } });
      await tx.customer.update({
        where: { id: ctx.id },
        data: { name: "Removed customer", email: null, phone: null, googleSub: null, passwordHash: null, notes: null, deletedAt: now() },
      });
    });
    await logActivity(prisma, null, { action: "customer.deleted", entityType: "customer", entityId: ctx.id, summary: "Customer removed their account (order records kept)" });
    if (before?.email) await notify(before.email, accountDeletedTemplate({ name: before.name }));
    return { deleted: true };
  }

  return {
    view,
    openSession,
    loadSession,
    revokeSession,
    revokeEverySession,
    /** the signed-in shopper's own record, for the account screen */
    async current(id: string) {
      const c = await prisma.customer.findUnique({ where: { id } });
      if (!c || c.deletedAt) throw notFound("We couldn't find your account.");
      return view(c);
    },
    register,
    login,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    changePassword,
    updateProfile,
    listAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
    listOrders,
    getOrder,
    claimOrder,
    deleteAccount,
    /** used by the Google callback once Google has vouched for the address */
    async findByGoogleSub(sub: string) {
      return prisma.customer.findUnique({ where: { googleSub: sub } });
    },
    async findByEmail(email: string) {
      return prisma.customer.findUnique({ where: { email } });
    },
    async linkGoogleSub(customerId: string, sub: string) {
      return prisma.customer.update({ where: { id: customerId }, data: { googleSub: sub, signInMethod: "google" } });
    },
    async createWithGoogle(input: { name: string; email: string; sub: string }) {
      return prisma.customer.create({
        data: {
          name: input.name,
          email: input.email,
          googleSub: input.sub,
          signInMethod: "google",
          // Google already proved this address, so the account starts confirmed
          emailVerifiedAt: now(),
        },
      });
    },
  };
}

export type CustomerAuthService = ReturnType<typeof createCustomerAuthService>;
