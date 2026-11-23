// WhatsApp sign-in codes. Generated and checked only here; the database keeps an HMAC of the code,
// never the code. Codes live 5 minutes, are single use, and both sending and checking are limited
// per number and per network. Answers never reveal whether a number already has an account.
import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";

import type { PrismaClient } from "@prisma/client";
import type { Request } from "express";

import type { Config } from "../config.js";
import { HttpError, badRequest } from "../errors.js";
import { isIndianMobile, normalizeIndianPhone } from "../lib/india.js";
import type { Logger } from "../logger.js";
import type { CustomerAuthService } from "./customerAuthService.js";
import type { WhatsAppService } from "./whatsappService.js";

export const OTP_RULES = { length: 6, ttlMs: 5 * 60_000, resendMs: 60_000, perHour: 3, maxAttempts: 5, lockMs: 15 * 60_000, perIpHour: 10 } as const;

const tooMany = (message: string, retryInSeconds: number) => new HttpError(429, "otp_limited", message, { retryInSeconds: Math.max(1, Math.ceil(retryInSeconds)) });
const mins = (ms: number) => Math.max(1, Math.ceil(ms / 60_000));

export function createWhatsAppOtp(deps: { prisma: PrismaClient; config: Config; wa: WhatsAppService; customers: CustomerAuthService; logger: Logger; now?: () => Date }) {
  const { prisma, config, wa, customers, logger } = deps;
  const now = deps.now ?? (() => new Date());
  const hash = (id: string, phone: string, code: string) => createHmac("sha256", config.authSecret).update(`wa-otp:${id}:${phone}:${code}`).digest("hex");

  const phoneOf = (input: string) => {
    const p = normalizeIndianPhone(String(input ?? ""));
    if (!isIndianMobile(p)) throw badRequest("Enter a valid 10-digit Indian mobile number.");
    return p;
  };

  async function availability(): Promise<{ available: boolean; reason: string | null }> {
    if (!wa.configured) return { available: false, reason: "WhatsApp isn't connected to the store yet." };
    if (!(await wa.automations()).otp) return { available: false, reason: "WhatsApp sign-in is switched off by the store." };
    if ((await wa.health()).tokenInvalidAt) return { available: false, reason: "WhatsApp is temporarily unavailable." };
    const ready = await wa.purposeReady("otp");
    return ready.ok ? { available: true, reason: null } : { available: false, reason: "The WhatsApp sign-in message hasn't been approved by Meta yet." };
  }

  async function lockedUntil(phone: string) {
    const locked = await prisma.whatsAppOtp.findFirst({ where: { phone, lockedUntil: { gt: now() } }, orderBy: { lockedUntil: "desc" } });
    return locked?.lockedUntil ?? null;
  }

  async function request(input: { phone: string }, ip: string | undefined) {
    const local = phoneOf(input.phone);
    const phone = `91${local}`;
    const avail = await availability();
    if (!avail.available) throw new HttpError(503, "whatsapp_otp_unavailable", "WhatsApp sign-in isn't available right now. Please use Google or your email and password.");
    const t = now();
    const lock = await lockedUntil(phone);
    if (lock) throw tooMany(`Too many wrong codes. Try again in about ${mins(lock.getTime() - t.getTime())} minute(s).`, (lock.getTime() - t.getTime()) / 1000);
    const hourAgo = new Date(t.getTime() - 3_600_000);
    const recent = await prisma.whatsAppOtp.findMany({ where: { phone, createdAt: { gte: hourAgo } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    const last = recent[0];
    if (last && t.getTime() - last.createdAt.getTime() < OTP_RULES.resendMs) throw tooMany("Please wait a moment before asking for a new code.", (OTP_RULES.resendMs - (t.getTime() - last.createdAt.getTime())) / 1000);
    if (recent.length >= OTP_RULES.perHour) {
      const oldest = recent[recent.length - 1]!;
      throw tooMany(`Too many codes requested. Try again in about ${mins(3_600_000 - (t.getTime() - oldest.createdAt.getTime()))} minute(s).`, (3_600_000 - (t.getTime() - oldest.createdAt.getTime())) / 1000);
    }
    const fromIp = ip ? await prisma.whatsAppOtp.count({ where: { ip: ip.slice(0, 64), createdAt: { gte: hourAgo } } }) : 0;
    if (fromIp >= OTP_RULES.perIpHour) throw tooMany("Too many sign-in codes from this network. Please try again later.", 15 * 60);

    const id = randomUUID();
    const code = String(randomInt(0, 10 ** OTP_RULES.length)).padStart(OTP_RULES.length, "0");
    await prisma.$transaction([
      // only the newest code works
      prisma.whatsAppOtp.updateMany({ where: { phone, consumedAt: null, expiresAt: { gt: t } }, data: { expiresAt: t } }),
      prisma.whatsAppOtp.create({ data: { id, phone, codeHash: hash(id, phone, code), expiresAt: new Date(t.getTime() + OTP_RULES.ttlMs), ip: ip?.slice(0, 64) ?? null } }),
    ]);
    const sent = await wa.sendNow({ kind: "otp", purpose: "otp", dedupeKey: `otp:${id}`, phone, storedValues: { body: ["••••••"] } }, { body: [code], button: code });
    if (!sent.ok) {
      await prisma.whatsAppOtp.update({ where: { id }, data: { expiresAt: now(), messageId: sent.messageId } });
      logger.warn("whatsapp otp not sent", { reason: sent.reason });
      throw new HttpError(502, "otp_send_failed", "We couldn't send the code on WhatsApp right now. Please try again in a minute, or use another way to sign in.");
    }
    await prisma.whatsAppOtp.update({ where: { id }, data: { messageId: sent.messageId } });
    return { expiresInSeconds: OTP_RULES.ttlMs / 1000, resendInSeconds: OTP_RULES.resendMs / 1000 };
  }

  async function verify(input: { phone: string; code: string }, req: Request) {
    const local = phoneOf(input.phone);
    const phone = `91${local}`;
    const code = String(input.code ?? "").trim();
    if (!/^\d{6}$/.test(code)) throw badRequest("Enter all 6 digits of the code.");
    const t = now();
    const lock = await lockedUntil(phone);
    if (lock) throw tooMany(`Too many wrong codes. Try again in about ${mins(lock.getTime() - t.getTime())} minute(s).`, (lock.getTime() - t.getTime()) / 1000);
    const row = await prisma.whatsAppOtp.findFirst({ where: { phone, consumedAt: null }, orderBy: { createdAt: "desc" } });
    if (!row || row.expiresAt <= t || row.attempts >= OTP_RULES.maxAttempts) throw new HttpError(400, "otp_expired", "This code has expired or was already used. Ask for a new one.");
    const a = Buffer.from(hash(row.id, phone, code)), b = Buffer.from(row.codeHash);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      await prisma.whatsAppOtp.updateMany({ where: { id: row.id, consumedAt: null }, data: { attempts: { increment: 1 } } });
      const after = await prisma.whatsAppOtp.findUniqueOrThrow({ where: { id: row.id } });
      if (after.attempts >= OTP_RULES.maxAttempts) {
        await prisma.whatsAppOtp.update({ where: { id: row.id }, data: { lockedUntil: new Date(t.getTime() + OTP_RULES.lockMs), expiresAt: t } });
        throw tooMany(`Too many wrong codes. Try again in ${OTP_RULES.lockMs / 60_000} minutes.`, OTP_RULES.lockMs / 1000);
      }
      const left = OTP_RULES.maxAttempts - after.attempts;
      throw new HttpError(400, "otp_wrong", `That code isn't right. ${left} attempt${left === 1 ? "" : "s"} left.`, { attemptsLeft: left });
    }
    // single use: only one request can flip consumedAt
    const used = await prisma.whatsAppOtp.updateMany({ where: { id: row.id, consumedAt: null, expiresAt: { gt: t }, attempts: { lt: OTP_RULES.maxAttempts } }, data: { consumedAt: t } });
    if (used.count !== 1) throw new HttpError(400, "otp_expired", "This code has expired or was already used. Ask for a new one.");

    let c = await prisma.customer.findUnique({ where: { phone: local } });
    let created = false;
    if (!c) {
      try {
        c = await prisma.customer.create({ data: { name: "", phone: local, signInMethod: "whatsapp", phoneVerifiedAt: t, lastLoginAt: t } });
        created = true;
      } catch {
        c = await prisma.customer.findUnique({ where: { phone: local } }); // created by a parallel request
      }
    }
    if (!c || c.deletedAt || c.status !== "ACTIVE") throw new HttpError(403, "account_unavailable", "This account can't sign in. Please contact us for help.");
    if (!created) c = await prisma.customer.update({ where: { id: c.id }, data: { phoneVerifiedAt: c.phoneVerifiedAt ?? t, lastLoginAt: t, failedLoginCount: 0 } });
    const session = await customers.openSession(c.id, req);
    return { customer: customers.view(c), session, created };
  }

  return { availability, request, verify };
}
export type WhatsAppOtpService = ReturnType<typeof createWhatsAppOtp>;
