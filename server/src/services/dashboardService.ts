import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";

import { toPaise } from "../lib/money.js";
import { istRange } from "./adminOrderService.js";

export const dashboardQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  includeTest: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
});

// Every figure is a database query over real orders. Revenue = verified paid orders only;
// COD not yet collected is shown separately; test-mode orders are excluded unless asked for.
export function createDashboardService(prisma: PrismaClient) {
  return {
    async summary(q: z.infer<typeof dashboardQuerySchema>) {
      const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
      const from = q.from ?? new Date(Date.now() + 330 * 60_000 - 29 * 86_400_000).toISOString().slice(0, 10);
      const to = q.to ?? today;
      const range = istRange(from, to);
      const test = q.includeTest ? {} : { isTest: false };
      const placed = { ...test, createdAt: range, status: { not: "PENDING_PAYMENT" as const } };

      const [paid, codOpen, byStatus, byPayment, awaiting, testCount, top, gte, lt] = await Promise.all([
        prisma.order.aggregate({ where: { ...test, paymentStatus: "PAID", paidAt: range }, _sum: { grandTotal: true }, _count: true }),
        prisma.order.aggregate({ where: { ...test, createdAt: range, paymentStatus: "COD_PENDING", status: { notIn: ["CANCELLED", "RETURNED"] } }, _sum: { grandTotal: true }, _count: true }),
        prisma.order.groupBy({ by: ["status"], where: { ...test, createdAt: range }, _count: true }),
        prisma.order.groupBy({ by: ["paymentMethod", "paymentStatus"], where: placed, _count: true, _sum: { grandTotal: true } }),
        prisma.order.count({ where: { ...test, status: "PENDING_PAYMENT" } }),
        prisma.order.count({ where: { isTest: true, createdAt: range } }),
        prisma.orderItem.groupBy({
          by: ["productId", "productName"],
          where: { order: { ...placed, status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] } } },
          _sum: { quantity: true, lineTotal: true }, orderBy: { _sum: { quantity: "desc" } }, take: 8,
        }),
        Promise.resolve(range.gte!), Promise.resolve(range.lt!),
      ]);

      // Daily series (India time) straight from MySQL.
      const testSql = q.includeTest ? Prisma.empty : Prisma.sql`AND isTest = false`;
      const series = await prisma.$queryRaw<{ day: string; orders: bigint; paid: Prisma.Decimal | null }[]>`
        SELECT DATE_FORMAT(DATE_ADD(createdAt, INTERVAL 330 MINUTE), '%Y-%m-%d') AS day,
               COUNT(*) AS orders,
               SUM(CASE WHEN paymentStatus = 'PAID' THEN grandTotal ELSE 0 END) AS paid
        FROM \`Order\`
        WHERE createdAt >= ${gte} AND createdAt < ${lt} AND status <> 'PENDING_PAYMENT' ${testSql}
        GROUP BY day ORDER BY day`;

      return {
        range: { from, to },
        includeTest: !!q.includeTest,
        revenuePaise: toPaise(paid._sum.grandTotal),
        paidOrders: paid._count,
        codOutstandingPaise: toPaise(codOpen._sum.grandTotal),
        codOutstandingOrders: codOpen._count,
        orderCount: byStatus.filter((s) => s.status !== "PENDING_PAYMENT").reduce((n, s) => n + s._count, 0),
        awaitingPayment: awaiting,
        testOrders: testCount,
        byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
        payments: byPayment.map((p) => ({ method: p.paymentMethod, status: p.paymentStatus, orders: p._count, amountPaise: toPaise(p._sum.grandTotal) })),
        topProducts: top.map((t) => ({ productId: t.productId, name: t.productName, quantity: t._sum.quantity ?? 0, salesPaise: toPaise(t._sum.lineTotal) })),
        series: series.map((s) => ({ day: s.day, orders: Number(s.orders), paidPaise: toPaise(s.paid) })),
      };
    },
  };
}
