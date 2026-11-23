import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;
export interface Actor { userId: string; ip?: string | undefined }

export function logActivity(db: Db, actor: Actor | null, entry: { action: string; entityType: string; entityId?: string; summary: string; meta?: Prisma.InputJsonValue }) {
  return db.adminActivityLog.create({
    data: {
      userId: actor?.userId ?? null,
      ip: actor?.ip ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary.slice(0, 500),
      ...(entry.meta !== undefined ? { meta: entry.meta } : {}),
    },
  });
}
