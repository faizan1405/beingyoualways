import { Router } from "express";
import { z } from "zod";

import type { Config } from "../config.js";
import { badRequest } from "../errors.js";
import { requirePermission } from "../middleware/auth.js";
import type { MediaService } from "../services/mediaService.js";

const idParam = (v: unknown) => {
  const p = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).safeParse(v);
  if (!p.success) throw badRequest("Invalid id.");
  return p.data;
};

const KINDS = ["PRODUCT_IMAGE", "GALLERY_SLIDE", "REVIEW_PHOTO", "REVIEW_VIDEO", "POSTER", "CONTENT_IMAGE"] as const;

/**
 * Upload settings travel as query parameters so the request body stays a plain file upload. The file
 * itself is checked by its bytes, never by its name, and is only ever read back through this service.
 */
const uploadQuery = z.object({
  kind: z.enum(KINDS),
  productId: z.string().trim().max(64).optional(),
  reviewId: z.string().trim().max(64).optional(),
  alt: z.string().trim().max(300).optional(),
  position: z.coerce.number().int().min(0).max(999).optional(),
  attach: z.enum(["true", "false"]).optional(),
});

const updateBody = z.object({
  alt: z.string().trim().max(300).optional(),
  position: z.coerce.number().int().min(0).max(999).optional(),
});

const listQuery = z.object({
  productId: z.string().trim().max(64).optional(),
  reviewId: z.string().trim().max(64).optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  kind: z.enum(KINDS).optional(),
});

export function adminMediaRoutes(media: MediaService, config: Config) {
  const r = Router();
  const actor = (req: { admin?: { user: { id: string } }; ip?: string }) => ({ userId: req.admin!.user.id, ip: req.ip });

  r.get("/", requirePermission("media.write"), async (req, res) => {
    res.json(await media.list(listQuery.parse(req.query)));
  });

  r.post("/upload", requirePermission("media.write"), async (req, res) => {
    const q = uploadQuery.parse(req.query);
    const out = await media.upload(req, { kind: q.kind, productId: q.productId, reviewId: q.reviewId, alt: q.alt, position: q.position }, actor(req));
    if (q.attach === "true" && q.productId) await media.attachToProduct(q.productId, out.id, actor(req));
    res.json({ media: out });
  });

  r.get("/inspect", requirePermission("media.write"), async (_req, res) => {
    res.json(await media.inspect());
  });

  r.patch("/:id", requirePermission("media.write"), async (req, res) => {
    res.json({ media: await media.update(idParam(req.params["id"]), updateBody.parse(req.body), actor(req)) });
  });

  r.post("/:id/delete", requirePermission("media.write"), async (req, res) => {
    res.json({ media: await media.archive(idParam(req.params["id"]), actor(req)) });
  });

  r.post("/:id/purge", requirePermission("media.write"), async (req, res) => {
    res.json(await media.purge(idParam(req.params["id"]), actor(req)));
  });

  r.post("/:id/attach", requirePermission("media.write"), async (req, res) => {
    const body = z.object({ productId: z.string().trim().max(64) }).parse(req.body);
    res.json(await media.attachToProduct(body.productId, idParam(req.params["id"]), actor(req)));
  });

  return r;
}

/**
 * Reads one file back. Anyone may fetch shop imagery; a story photo or video only appears once the
 * story itself is published, consented and verified. Admins can always read their own files.
 */
export function mediaServeRoutes(media: MediaService, _config: Config) {
  const r = Router();
  r.get("/:id", async (req, res) => {
    await media.serve(idParam(req.params["id"]), req, res, Boolean(req.admin));
  });
  return r;
}
