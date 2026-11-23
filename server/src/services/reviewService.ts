import { Prisma, type PrismaClient, type Review } from "@prisma/client";
import { z } from "zod";

import { badRequest, conflict, notFound } from "../errors.js";
import { logActivity, type Actor } from "./activity.js";

/**
 * Customer stories. The public list is the same rule the website already follows: only a story that is
 * published, consented and from a verified purchase may be shown. Nothing here invents a review —
 * rows are written by staff from real messages, and media must be a file the store actually holds.
 */
const mediaItem = z.object({
  type: z.enum(["photo", "video"]),
  url: z.string().trim().min(1).max(500),
  mediaId: z.string().trim().max(64).optional(),
  role: z.enum(["before", "after", "poster"]).optional(),
});

export const reviewCreateSchema = z.object({
  authorName: z.string().trim().min(2, "Enter the name shown with the story.").max(120),
  body: z.string().trim().min(10, "The story text is too short.").max(4000),
  rating: z.number().int().min(1).max(5).optional(),
  productId: z.string().trim().max(64).optional(),
  category: z.string().trim().max(40).optional(),
  city: z.string().trim().max(100).optional(),
  verifiedPurchase: z.boolean().default(false),
  consentGiven: z.boolean().default(false),
  status: z.enum(["PENDING", "PUBLISHED", "HIDDEN"]).default("PENDING"),
  placements: z.array(z.enum(["home", "explore"])).max(2).optional(),
  media: z.array(mediaItem).max(8).optional(),
});

export const reviewUpdateSchema = reviewCreateSchema.partial();

export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;
export type ReviewUpdateInput = z.infer<typeof reviewUpdateSchema>;

const json = (v: unknown) => (v == null ? Prisma.DbNull : (v as Prisma.InputJsonValue));

export function createReviewService(prisma: PrismaClient) {
  const view = (r: Review) => ({
    id: r.id,
    authorName: r.authorName,
    body: r.body,
    rating: r.rating,
    productId: r.productId,
    category: r.category,
    city: r.city,
    verifiedPurchase: r.verifiedPurchase,
    consentGiven: r.consentGiven,
    status: r.status,
    placements: (r.placements as string[] | null) ?? null,
    media: (r.media as unknown[] | null) ?? [],
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  });

  /** the only shape the shop is allowed to read */
  const publicWhere = {
    status: "PUBLISHED" as const,
    consentGiven: true,
    verifiedPurchase: true,
  };

  return {
    view,

    async listPublic(placement?: "home" | "explore") {
      const rows = await prisma.review.findMany({
        where: {
          ...publicWhere,
          ...(placement ? { placements: { path: "$", array_contains: [placement] } } : {}),
        },
        orderBy: { createdAt: "desc" },
      });
      return { reviews: rows.map(view) };
    },

    async listAdmin(filter: { status?: "PENDING" | "PUBLISHED" | "HIDDEN"; productId?: string }) {
      const rows = await prisma.review.findMany({
        where: { ...(filter.status ? { status: filter.status } : {}), ...(filter.productId ? { productId: filter.productId } : {}) },
        orderBy: { createdAt: "desc" },
      });
      return { reviews: rows.map(view) };
    },

    async create(input: ReviewCreateInput, actor: Actor) {
      if (input.productId && !(await prisma.product.findUnique({ where: { id: input.productId }, select: { id: true } }))) {
        throw badRequest("That product isn't in the catalogue.");
      }
      // a story may only go public with consent and a verified purchase — checked here too, not only in the UI
      if (input.status === "PUBLISHED" && !(input.consentGiven && input.verifiedPurchase)) {
        throw conflict("A story can only be published once consent is recorded and the purchase is verified.");
      }
      const r = await prisma.review.create({
        data: {
          authorName: input.authorName,
          body: input.body,
          rating: input.rating ?? null,
          productId: input.productId ?? null,
          category: input.category ?? null,
          city: input.city ?? null,
          verifiedPurchase: input.verifiedPurchase,
          consentGiven: input.consentGiven,
          status: input.status,
          placements: json(input.placements ?? null),
          media: json(input.media ?? null),
          consentAt: input.consentGiven ? new Date() : null,
        },
      });
      await logActivity(prisma, actor, { action: "review.create", entityType: "review", entityId: r.id, summary: `Added a customer story (${r.status.toLowerCase()})` });
      return view(r);
    },

    async update(id: string, input: ReviewUpdateInput, actor: Actor) {
      const before = await prisma.review.findUnique({ where: { id } });
      if (!before) throw notFound("That story isn't in the list.");
      const next = {
        consentGiven: input.consentGiven ?? before.consentGiven,
        verifiedPurchase: input.verifiedPurchase ?? before.verifiedPurchase,
        status: input.status ?? before.status,
      };
      if (next.status === "PUBLISHED" && !(next.consentGiven && next.verifiedPurchase)) {
        throw conflict("A story can only be published once consent is recorded and the purchase is verified.");
      }
      const r = await prisma.review.update({
        where: { id },
        data: {
          ...(input.authorName !== undefined ? { authorName: input.authorName } : {}),
          ...(input.body !== undefined ? { body: input.body } : {}),
          ...(input.rating !== undefined ? { rating: input.rating } : {}),
          ...(input.productId !== undefined ? { productId: input.productId } : {}),
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.city !== undefined ? { city: input.city } : {}),
          ...(input.consentGiven !== undefined ? { consentGiven: input.consentGiven, consentAt: input.consentGiven ? new Date() : null } : {}),
          ...(input.verifiedPurchase !== undefined ? { verifiedPurchase: input.verifiedPurchase } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.placements !== undefined ? { placements: json(input.placements) } : {}),
          ...(input.media !== undefined ? { media: json(input.media) } : {}),
        },
      });
      await logActivity(prisma, actor, { action: "review.update", entityType: "review", entityId: id, summary: `Updated a customer story (${r.status.toLowerCase()})` });
      return view(r);
    },

    async remove(id: string, actor: Actor) {
      const before = await prisma.review.findUnique({ where: { id }, select: { id: true } });
      if (!before) throw notFound("That story isn't in the list.");
      await prisma.review.delete({ where: { id } });
      await logActivity(prisma, actor, { action: "review.delete", entityType: "review", entityId: id, summary: "Removed a customer story" });
      return { deleted: true };
    },
  };
}

export type ReviewService = ReturnType<typeof createReviewService>;
