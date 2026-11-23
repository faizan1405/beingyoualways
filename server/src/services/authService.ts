import type { PrismaClient } from "@prisma/client";

import type { Config } from "../config.js";
import { HttpError, badRequest, conflict } from "../errors.js";
import { ROLES, type RoleKey } from "../lib/permissions.js";
import { logActivity } from "./activity.js";
import { dummyHash, hashPassword, needsRehash, passwordProblem, verifyPassword } from "./password.js";
import { hashToken, newToken } from "./tokens.js";

export interface AdminIdentity {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}

export interface AdminContext { sessionId: string; user: AdminIdentity }

const INVALID = new HttpError(401, "invalid_credentials", "Email or password is incorrect.");
const normalizeEmail = (e: string) => e.trim().toLowerCase();

const userWithRoles = { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } as const;

type UserRow = { id: string; email: string; name: string; roles: { role: { key: string; permissions: { permission: { key: string } }[] } }[] };
export const toIdentity = (u: UserRow): AdminIdentity => ({
  id: u.id,
  email: u.email,
  name: u.name,
  roles: u.roles.map((r) => r.role.key),
  permissions: [...new Set(u.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key)))].sort(),
});

export function createAuthService(prisma: PrismaClient, config: Config) {
  return {
    /** Verifies credentials, applies the per-account lockout and opens a server-side session. */
    async login(emailInput: string, password: string, meta: { ip?: string | undefined; userAgent?: string | undefined }) {
      const email = normalizeEmail(emailInput);
      const user = await prisma.user.findUnique({ where: { email }, include: userWithRoles });
      const now = new Date();
      if (!user || !user.isActive || user.roles.length === 0) {
        await verifyPassword(await dummyHash(), password);
        throw INVALID;
      }
      if (user.lockedUntil && user.lockedUntil > now) {
        const mins = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60_000);
        throw new HttpError(429, "account_locked", `Too many failed sign-in attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
      }
      const ok = await verifyPassword(user.passwordHash, password);
      if (!ok) {
        const fails = user.failedLoginCount + 1;
        const lock = fails >= config.login.maxAttempts;
        await prisma.user.update({
          where: { id: user.id },
          data: lock ? { failedLoginCount: 0, lockedUntil: new Date(now.getTime() + config.login.lockMs) } : { failedLoginCount: fails },
        });
        await logActivity(prisma, { userId: user.id, ip: meta.ip }, { action: lock ? "auth.locked" : "auth.failed", entityType: "user", entityId: user.id, summary: lock ? "Account locked after repeated failed sign-ins" : "Failed sign-in" });
        throw INVALID;
      }
      const token = newToken();
      const session = await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now, ...(needsRehash(user.passwordHash) ? { passwordHash: await hashPassword(password) } : {}) },
        });
        const s = await tx.session.create({
          data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(now.getTime() + config.session.ttlMs), ip: meta.ip?.slice(0, 64) ?? null, userAgent: meta.userAgent?.slice(0, 255) ?? null },
        });
        await logActivity(tx, { userId: user.id, ip: meta.ip }, { action: "auth.login", entityType: "user", entityId: user.id, summary: "Signed in" });
        return s;
      });
      return { token, expiresAt: session.expiresAt, user: toIdentity(user) };
    },

    /** Resolves a cookie token to an active session (expired, idle, revoked or disabled → null). */
    async authenticate(token: string | undefined): Promise<AdminContext | null> {
      if (!token || token.length > 200) return null;
      const s = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { include: userWithRoles } } });
      const now = Date.now();
      if (!s || s.revokedAt || s.expiresAt.getTime() <= now || s.lastSeenAt.getTime() + config.session.idleMs <= now) return null;
      if (!s.user.isActive || s.user.roles.length === 0 || s.user.passwordChangedAt > s.createdAt) return null;
      if (now - s.lastSeenAt.getTime() > 60_000) await prisma.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date(now) } });
      return { sessionId: s.id, user: toIdentity(s.user) };
    },

    async logout(ctx: AdminContext, ip?: string) {
      await prisma.session.updateMany({ where: { id: ctx.sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
      await logActivity(prisma, { userId: ctx.user.id, ip }, { action: "auth.logout", entityType: "user", entityId: ctx.user.id, summary: "Signed out" });
    },
  };
}
export type AuthService = ReturnType<typeof createAuthService>;

/** Admin bootstrap (CLI only — there is no public sign-up). The first account must be an owner. */
export async function createAdminUser(prisma: PrismaClient, input: { email: string; name: string; password: string; role: RoleKey }, opts: { allowAdditional?: boolean } = {}) {
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest("Enter a valid email address.");
  if (input.name.trim().length < 2) throw badRequest("Enter the admin's name.");
  if (!(input.role in ROLES)) throw badRequest(`Unknown role. Use one of: ${Object.keys(ROLES).join(", ")}.`);
  const problem = passwordProblem(input.password, email);
  if (problem) throw badRequest(`Password not accepted: ${problem}`);
  const existing = await prisma.user.count();
  if (existing > 0 && !opts.allowAdditional) throw conflict("An admin account already exists. Use --allow-additional to add another one.");
  if (existing === 0 && input.role !== "owner") throw badRequest("The first admin account must be the owner.");
  if (await prisma.user.findUnique({ where: { email } })) throw conflict("An account with that email already exists.");
  const role = await prisma.role.findUnique({ where: { key: input.role } });
  if (!role) throw badRequest("Roles are missing — run the database seed first (npm run db:seed:prod).");
  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email, name: input.name.trim(), passwordHash, roles: { create: { roleId: role.id } } } });
    await logActivity(tx, null, { action: "user.create", entityType: "user", entityId: user.id, summary: `Admin account created (${input.role}) from the server console` });
    return user;
  });
}

/** Recovery from the server console: sets a new password, clears the lockout and signs out every session. */
export async function resetAdminPassword(prisma: PrismaClient, emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  const problem = passwordProblem(password, email);
  if (problem) throw badRequest(`Password not accepted: ${problem}`);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw badRequest("No admin account uses that email.");
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, passwordChangedAt: now, failedLoginCount: 0, lockedUntil: null } });
    await tx.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } });
    await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
    await logActivity(tx, null, { action: "user.password_reset", entityType: "user", entityId: user.id, summary: "Password reset from the server console; all sessions signed out" });
  });
}

/** Groundwork for emailed recovery links (email delivery is a later phase): single-use, hashed, 30 minutes. */
export async function issuePasswordResetToken(prisma: PrismaClient, userId: string) {
  const token = newToken();
  await prisma.passwordResetToken.create({ data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 30 * 60_000) } });
  return token;
}

export async function consumePasswordResetToken(prisma: PrismaClient, token: string, newPassword: string) {
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!row || row.usedAt || row.expiresAt <= new Date()) throw badRequest("This reset link is invalid or has expired.");
  await prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  await resetAdminPassword(prisma, row.user.email, newPassword);
}
