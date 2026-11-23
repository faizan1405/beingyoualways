import { Router } from "express";
import { z } from "zod";

import { badRequest } from "../errors.js";
import { createProductInput, updateProductInput } from "../lib/productSchema.js";
import { requirePermission } from "../middleware/auth.js";
import type { ProductService } from "../services/productService.js";

const idParam = z.string().regex(/^[A-Za-z0-9_-]{1,191}$/);
const param = (v: unknown) => { const p = idParam.safeParse(v); if (!p.success) throw badRequest("Invalid product id."); return p.data; };

/** Public catalogue: active products only. */
export function publicProductRoutes(products: ProductService) {
  const r = Router();
  r.get("/", async (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=30");
    res.json({ products: await products.listPublic() });
  });
  r.get("/:idOrSlug", async (req, res) => {
    res.setHeader("Cache-Control", "public, max-age=30");
    res.json({ product: await products.getPublic(param(req.params["idOrSlug"])) });
  });
  return r;
}

export function categoryRoutes(products: ProductService) {
  const r = Router();
  r.get("/", async (_req, res) => { res.json({ categories: await products.categories() }); });
  return r;
}

/** Admin catalogue: every route needs a signed-in admin with the right permission. */
export function adminProductRoutes(products: ProductService) {
  const r = Router();
  const actor = (req: Express.Request & { ip?: string | undefined }) => ({ userId: req.admin!.user.id, ip: req.ip });
  r.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
  r.get("/", requirePermission("products.read"), async (_req, res) => { res.json({ products: await products.listAdmin() }); });
  r.get("/:id", requirePermission("products.read"), async (req, res) => { res.json({ product: await products.getAdmin(param(req.params["id"])) }); });
  r.post("/", requirePermission("products.write"), async (req, res) => {
    res.status(201).json({ product: await products.create(createProductInput.parse(req.body), actor(req)) });
  });
  r.patch("/:id", requirePermission("products.write"), async (req, res) => {
    res.json({ product: await products.update(param(req.params["id"]), updateProductInput.parse(req.body), actor(req)) });
  });
  /** DELETE archives; DELETE ?permanent=true removes a hidden, never-ordered product. */
  r.delete("/:id", requirePermission("products.delete"), async (req, res) => {
    const id = param(req.params["id"]);
    if (req.query["permanent"] === "true") { await products.destroy(id, actor(req)); res.json({ deleted: true }); return; }
    res.json({ archived: true, product: await products.archive(id, actor(req)) });
  });
  return r;
}
