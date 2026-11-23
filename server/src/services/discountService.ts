import { Prisma, type Discount, type PrismaClient } from "@prisma/client";
import { z } from "zod";

import { HttpError, notFound } from "../errors.js";
import { formatInr, fromPaise, toPaise } from "../lib/money.js";
import { logActivity, type Actor } from "./activity.js";

const paise = z.number().int().min(0).max(10_000_000_00);
export const discountInputSchema = z
  .object({
    code: z.string().trim().toUpperCase().min(3, "Codes need at least 3 characters").max(40).regex(/^[A-Z0-9_-]+$/, "Use letters, numbers, - and _ only"),
    description: z.string().trim().max(200).default(""),
    type: z.enum(["PERCENT", "FIXED"]),
    /** PERCENT: 0.01–100 (percent). FIXED: paise. */
    percentOff: z.number().min(0.01).max(100).multipleOf(0.01).nullable().default(null),
    amountOffPaise: paise.positive().nullable().default(null),
    minOrderPaise: paise.nullable().default(null),
    maxDiscountPaise: paise.positive().nullable().default(null),
    startsAt: z.string().datetime({ offset: true }).nullable().default(null),
    endsAt: z.string().datetime({ offset: true }).nullable().default(null),
    usageLimit: z.number().int().min(1).max(1_000_000).nullable().default(null),
    active: z.boolean(),
    productIds: z.array(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)).max(200).nullable().default(null),
    categorySlugs: z.array(z.string().regex(/^[a-z0-9-]{1,80}$/)).max(20).nullable().default(null),
  })
  .superRefine((d, ctx) => {
    if (d.type === "PERCENT" && d.percentOff == null) ctx.addIssue({ code: "custom", path: ["percentOff"], message: "Enter the percentage off" });
    if (d.type === "FIXED" && d.amountOffPaise == null) ctx.addIssue({ code: "custom", path: ["amountOffPaise"], message: "Enter the amount off" });
    if (d.startsAt && d.endsAt && new Date(d.startsAt) >= new Date(d.endsAt)) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "The end date must be after the start date" });
  });
export type DiscountInput = z.infer<typeof discountInputSchema>;

const json = (v: string[] | null) => (v && v.length ? (v as Prisma.InputJsonValue) : Prisma.DbNull);
export const discountDto = (d: Discount) => ({
  id: d.id, code: d.code, description: d.description ?? "", type: d.type,
  percentOff: d.type === "PERCENT" ? Number(d.value) : null, amountOffPaise: d.type === "FIXED" ? toPaise(d.value) : null,
  minOrderPaise: d.minOrder == null ? null : toPaise(d.minOrder), maxDiscountPaise: d.maxDiscount == null ? null : toPaise(d.maxDiscount),
  startsAt: d.startsAt?.toISOString() ?? null, endsAt: d.endsAt?.toISOString() ?? null, usageLimit: d.usageLimit, usedCount: d.usedCount, active: d.active,
  productIds: Array.isArray(d.productIds) ? (d.productIds as string[]) : null, categorySlugs: Array.isArray(d.categorySlugs) ? (d.categorySlugs as string[]) : null,
  createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString(),
});

const data = (d: DiscountInput) => ({
  code: d.code, description: d.description || null, type: d.type,
  value: d.type === "PERCENT" ? new Prisma.Decimal(d.percentOff!) : fromPaise(d.amountOffPaise!),
  minOrder: d.minOrderPaise == null ? null : fromPaise(d.minOrderPaise), maxDiscount: d.type === "PERCENT" && d.maxDiscountPaise != null ? fromPaise(d.maxDiscountPaise) : null,
  startsAt: d.startsAt ? new Date(d.startsAt) : null, endsAt: d.endsAt ? new Date(d.endsAt) : null, usageLimit: d.usageLimit, active: d.active,
  productIds: json(d.productIds), categorySlugs: json(d.categorySlugs),
});
const describe = (d: DiscountInput) => `${d.code} (${d.type === "PERCENT" ? `${d.percentOff}% off` : `${formatInr(d.amountOffPaise!)} off`}, ${d.active ? "on" : "off"})`;

export function createDiscountService(prisma: PrismaClient) {
  return {
    list: async () => (await prisma.discount.findMany({ orderBy: { createdAt: "desc" } })).map(discountDto),
    async create(input: DiscountInput, actor: Actor) {
      return prisma.$transaction(async (tx) => {
        const d = await tx.discount.create({ data: data(input) });
        await logActivity(tx, actor, { action: "discount.create", entityType: "discount", entityId: d.id, summary: `Created discount ${describe(input)}` });
        return discountDto(d);
      });
    },
    async update(id: string, input: DiscountInput, actor: Actor) {
      const before = await prisma.discount.findUnique({ where: { id } });
      if (!before) throw notFound("Discount not found.");
      if (before.usedCount > 0 && before.code !== input.code) throw new HttpError(409, "conflict", "A code that has been used can't be renamed — create a new code instead.");
      return prisma.$transaction(async (tx) => {
        const d = await tx.discount.update({ where: { id }, data: data(input) });
        await logActivity(tx, actor, { action: "discount.update", entityType: "discount", entityId: id, summary: `Updated discount ${describe(input)}` });
        return discountDto(d);
      });
    },
    async remove(id: string, actor: Actor) {
      const d = await prisma.discount.findUnique({ where: { id }, include: { _count: { select: { orders: true } } } });
      if (!d) throw notFound("Discount not found.");
      if (d._count.orders > 0 || d.usedCount > 0) throw new HttpError(409, "conflict", "This code is on existing orders — switch it off instead of deleting it.");
      await prisma.$transaction([prisma.discount.delete({ where: { id } }), prisma.adminActivityLog.create({ data: { userId: actor.userId, ip: actor.ip ?? null, action: "discount.delete", entityType: "discount", entityId: id, summary: `Deleted unused discount ${d.code}` } })]);
      return { deleted: true };
    },
  };
}
