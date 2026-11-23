import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { notFound } from "../errors.js";
import { toPaise } from "../lib/money.js";
import { logActivity, type Actor } from "./activity.js";
import { totalsOf } from "./orderShared.js";

export const customerFilterSchema = z.object({ q: z.string().trim().max(100).optional(), status: z.enum(["ACTIVE", "BLOCKED"]).optional() });
export const customerUpdateSchema = z.object({ notes: z.string().trim().max(4000).optional(), status: z.enum(["ACTIVE", "BLOCKED"]).optional() });

// Customers are created only from real orders (or, later, verified sign-ins). Spend counts only verified paid, non-test orders.
export function createAdminCustomerService(prisma: PrismaClient) {
  async function stats(ids: string[]) {
    const orders = await prisma.order.findMany({ where: { customerId: { in: ids }, isTest: false }, select: { customerId: true, grandTotal: true, paymentStatus: true, status: true, createdAt: true } });
    const m = new Map<string, { orderCount: number; paidSpendPaise: number; codOutstandingPaise: number; lastOrderAt: string | null }>();
    for (const id of ids) m.set(id, { orderCount: 0, paidSpendPaise: 0, codOutstandingPaise: 0, lastOrderAt: null });
    for (const o of orders) {
      const s = m.get(o.customerId!)!;
      if (o.status !== "PENDING_PAYMENT") s.orderCount++;
      if (o.paymentStatus === "PAID") s.paidSpendPaise += toPaise(o.grandTotal);
      if (o.paymentStatus === "COD_PENDING" && o.status !== "CANCELLED" && o.status !== "RETURNED") s.codOutstandingPaise += toPaise(o.grandTotal);
      const at = o.createdAt.toISOString();
      if (!s.lastOrderAt || at > s.lastOrderAt) s.lastOrderAt = at;
    }
    return m;
  }

  return {
    async list(f: z.infer<typeof customerFilterSchema>) {
      const q = f.q?.trim();
      const rows = await prisma.customer.findMany({
        where: { ...(f.status ? { status: f.status } : {}), ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q.toLowerCase() } }, { phone: { contains: q.replace(/\D/g, "") || q } }] } : {}) },
        orderBy: { createdAt: "desc" }, take: 500,
      });
      const s = await stats(rows.map((r) => r.id));
      return { customers: rows.map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, status: c.status, createdAt: c.createdAt.toISOString(), ...s.get(c.id)! })) };
    },

    async detail(id: string) {
      const c = await prisma.customer.findUnique({ where: { id }, include: { addresses: { orderBy: { createdAt: "desc" }, take: 20 }, orders: { orderBy: { createdAt: "desc" }, take: 100 } } });
      if (!c) throw notFound("Customer not found.");
      const s = (await stats([id])).get(id)!;
      return {
        id: c.id, name: c.name, email: c.email, phone: c.phone, status: c.status, notes: c.notes ?? "", createdAt: c.createdAt.toISOString(), ...s,
        addresses: c.addresses.map((a) => ({ id: a.id, label: a.label, name: a.name, phone: a.phone, line1: a.line1, line2: a.line2, city: a.city, state: a.state, pincode: a.pincode })),
        orders: c.orders.map((o) => ({ id: o.id, orderNumber: o.orderNumber, createdAt: o.createdAt.toISOString(), status: o.status, paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus, totalPaise: totalsOf(o).totalPaise, isTest: o.isTest })),
      };
    },

    async update(id: string, input: z.infer<typeof customerUpdateSchema>, actor: Actor) {
      const c = await prisma.customer.findUnique({ where: { id } });
      if (!c) throw notFound("Customer not found.");
      await prisma.$transaction(async (tx) => {
        await tx.customer.update({ where: { id }, data: { ...(input.notes !== undefined ? { notes: input.notes } : {}), ...(input.status ? { status: input.status } : {}) } });
        const parts = [input.notes !== undefined ? "notes" : null, input.status && input.status !== c.status ? `status ${c.status.toLowerCase()} → ${input.status.toLowerCase()}` : null].filter(Boolean);
        await logActivity(tx, actor, { action: "customer.update", entityType: "customer", entityId: id, summary: `Customer ${c.name}: ${parts.join(", ") || "no change"}` });
      });
      return this.detail(id);
    },
  };
}
