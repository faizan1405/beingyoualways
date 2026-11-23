import { Router } from "express";
import { z } from "zod";

import { badRequest } from "../errors.js";
import { requirePermission } from "../middleware/auth.js";
import { contentBulkSchema, contentWriteSchema, type SiteContentService } from "../services/siteContentService.js";

const keyParam = (v: unknown) => {
  const p = z.string().regex(/^[a-z0-9][a-z0-9_.-]{0,99}$/).safeParse(v);
  if (!p.success) throw badRequest("That name isn't valid.");
  return p.data;
};

/** Stored wording — the website merges it over its own defaults, so an empty table is a normal state. */
export function publicContentRoutes(content: SiteContentService) {
  const r = Router();
  r.get("/", async (_req, res) => {
    res.json(await content.read());
  });
  return r;
}

export function adminContentRoutes(content: SiteContentService) {
  const r = Router();
  const actor = (req: { admin?: { user: { id: string } }; ip?: string }) => ({ userId: req.admin!.user.id, ip: req.ip });

  r.get("/", requirePermission("content.read"), async (_req, res) => {
    res.json(await content.read());
  });

  r.put("/", requirePermission("content.write"), async (req, res) => {
    res.json(await content.writeBulk(contentBulkSchema.parse(req.body).items, actor(req)));
  });

  r.post("/", requirePermission("content.write"), async (req, res) => {
    res.json(await content.write(contentWriteSchema.parse(req.body), actor(req)));
  });

  r.post("/:key/delete", requirePermission("content.write"), async (req, res) => {
    res.json(await content.remove(keyParam(req.params["key"]), actor(req)));
  });

  return r;
}
