import { Prisma, type PrismaClient, type SiteContent } from "@prisma/client";
import { z } from "zod";

import { badRequest } from "../errors.js";
import { logActivity, type Actor } from "./activity.js";

/**
 * Website wording and settings the owner can change without a code change. Each entry is one named
 * JSON document. The website keeps its own defaults and only overrides what is stored here, so an
 * empty table means "the site looks like the built-in copy" — never a blank page.
 */
const keySchema = z.string().regex(/^[a-z0-9][a-z0-9_.-]{0,99}$/, "Use letters, numbers, dot, dash or underscore for the name.");

const valueSchema = z.union([z.record(z.string(), z.unknown()), z.array(z.unknown()), z.string(), z.number(), z.boolean()]);

export const contentWriteSchema = z.object({
  key: keySchema,
  value: valueSchema,
});

export const contentBulkSchema = z.object({
  items: z.record(z.string(), valueSchema).refine((v) => Object.keys(v).length > 0, "Nothing was sent to save."),
});

export type ContentWriteInput = z.infer<typeof contentWriteSchema>;

const json = (v: unknown) => (v as Prisma.InputJsonValue);

export function createSiteContentService(prisma: PrismaClient) {
  const asRecord = (rows: SiteContent[]) => {
    const out: Record<string, unknown> = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  };

  return {
    /** everything stored — the website merges this over its own defaults */
    async read() {
      const rows = await prisma.siteContent.findMany({ orderBy: { key: "asc" } });
      return { content: asRecord(rows) };
    },

    async write(input: ContentWriteInput, actor: Actor) {
      await prisma.siteContent.upsert({
        where: { key: input.key },
        create: { key: input.key, value: json(input.value) },
        update: { value: json(input.value) },
      });
      await logActivity(prisma, actor, { action: "content.write", entityType: "content", entityId: input.key, summary: `Saved website content: ${input.key}` });
      return { saved: input.key };
    },

    async writeBulk(items: Record<string, unknown>, actor: Actor) {
      for (const [key, value] of Object.entries(items)) {
        const parsed = keySchema.safeParse(key);
        if (!parsed.success) throw badRequest("One of the names isn't valid.");
        await prisma.siteContent.upsert({
          where: { key },
          create: { key, value: json(value) },
          update: { value: json(value) },
        });
      }
      await logActivity(prisma, actor, { action: "content.write", entityType: "content", entityId: "bulk", summary: `Saved ${Object.keys(items).length} website content entries` });
      return { saved: Object.keys(items).length };
    },

    async remove(key: string, actor: Actor) {
      const parsed = keySchema.safeParse(key);
      if (!parsed.success) throw badRequest("That name isn't valid.");
      await prisma.siteContent.deleteMany({ where: { key: parsed.data } });
      await logActivity(prisma, actor, { action: "content.delete", entityType: "content", entityId: parsed.data, summary: `Removed website content: ${parsed.data}` });
      return { removed: parsed.data };
    },
  };
}

export type SiteContentService = ReturnType<typeof createSiteContentService>;
