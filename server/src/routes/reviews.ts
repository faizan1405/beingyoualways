import { Router } from "express";
import { z } from "zod";

import { badRequest } from "../errors.js";
import { requirePermission } from "../middleware/auth.js";
import { reviewCreateSchema, reviewUpdateSchema, type ReviewService } from "../services/reviewService.js";

const idParam = (v: unknown) => {
  const p = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).safeParse(v);
  if (!p.success) throw badRequest("Invalid id.");
  return p.data;
};

/** Public stories: published, consented and from a verified purchase — nothing else. */
export function publicReviewRoutes(reviews: ReviewService) {
  const r = Router();
  const q = z.object({ placement: z.enum(["home", "explore"]).optional() });
  r.get("/", async (req, res) => {
    const parsed = q.safeParse(req.query);
    if (!parsed.success) throw badRequest("That filter isn't valid.");
    res.json(await reviews.listPublic(parsed.data.placement));
  });
  return r;
}

export function adminReviewRoutes(reviews: ReviewService) {
  const r = Router();
  const actor = (req: { admin?: { user: { id: string } }; ip?: string }) => ({ userId: req.admin!.user.id, ip: req.ip });
  const listQuery = z.object({
    status: z.enum(["PENDING", "PUBLISHED", "HIDDEN"]).optional(),
    productId: z.string().trim().max(64).optional(),
  });

  r.get("/", requirePermission("content.read"), async (req, res) => {
    res.json(await reviews.listAdmin(listQuery.parse(req.query)));
  });

  r.post("/", requirePermission("reviews.moderate"), async (req, res) => {
    res.json({ review: await reviews.create(reviewCreateSchema.parse(req.body), actor(req)) });
  });

  r.patch("/:id", requirePermission("reviews.moderate"), async (req, res) => {
    res.json({ review: await reviews.update(idParam(req.params["id"]), reviewUpdateSchema.parse(req.body), actor(req)) });
  });

  r.post("/:id/delete", requirePermission("reviews.moderate"), async (req, res) => {
    res.json(await reviews.remove(idParam(req.params["id"]), actor(req)));
  });

  return r;
}
