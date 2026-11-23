import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";

import { badRequest, conflict, notFound } from "../errors.js";
import { productInclude, toAdminProduct, toPublicProduct, type ProductRow } from "../lib/productDto.js";
import { productRuleProblems, type CreateProductInput, type UpdateProductInput, type VariantInput } from "../lib/productSchema.js";
import { logActivity, type Actor } from "./activity.js";

const STATUS = { active: "ACTIVE", draft: "DRAFT", archived: "ARCHIVED" } as const;
const json = (v: unknown) => (v == null ? Prisma.DbNull : (v as Prisma.InputJsonValue));
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function createProductService(prisma: PrismaClient) {
  const categoryId = async (tx: Prisma.TransactionClient, slug: string) => {
    const c = await tx.category.findUnique({ where: { slug } });
    if (!c) throw badRequest("Unknown category.");
    return c.id;
  };

  const ensureSlugFree = async (tx: Prisma.TransactionClient, slug: string, exceptId?: string) => {
    const other = await tx.product.findUnique({ where: { slug }, select: { id: true } });
    if (other && other.id !== exceptId) throw conflict("Another product already uses this web address — change the name or address.");
  };

  const checkRules = (status: string, variants: VariantInput[]) => {
    const problems = productRuleProblems({ status, variants });
    if (problems.length) throw badRequest(problems.join(" "));
  };

  /** Replaces sizes/shades: existing ids are updated, new ones created, removed ones deleted (unless already ordered). */
  async function writeVariants(tx: Prisma.TransactionClient, productId: string, variants: VariantInput[], previous: ProductRow["variants"]) {
    const prevById = new Map(previous.map((v) => [v.id, v]));
    const keep = new Set<string>();
    for (const [position, v] of variants.entries()) {
      const prev = v.id ? prevById.get(v.id) : undefined;
      if (v.id && !prev && (await tx.productVariant.findUnique({ where: { id: v.id }, select: { id: true } }))) throw conflict("A size/shade id is already used by another product.");
      const id = prev?.id ?? v.id ?? `v-${randomUUID()}`;
      keep.add(id);
      const tracked = v.stockTracked ?? true;
      const quantity = tracked ? (v.stock ?? prev?.inventory?.quantity ?? 0) : null;
      const data = { label: v.label, kind: v.kind === "shade" ? ("SHADE" as const) : ("SIZE" as const), price: v.price, compareAtPrice: v.compareAtPrice ?? null, swatch: v.swatch ?? null, position };
      if (prev) await tx.productVariant.update({ where: { id }, data });
      else await tx.productVariant.create({ data: { id, productId, ...data } });
      await tx.inventory.upsert({ where: { variantId: id }, create: { variantId: id, quantity }, update: { quantity } });
    }
    const removed = previous.filter((v) => !keep.has(v.id)).map((v) => v.id);
    if (removed.length) {
      const ordered = await tx.orderItem.count({ where: { variantId: { in: removed } } });
      if (ordered > 0) throw conflict("A size or shade that already has orders can't be removed — set its stock to 0 instead.");
      await tx.productVariant.deleteMany({ where: { id: { in: removed } } });
    }
  }

  async function writeImages(tx: Prisma.TransactionClient, productId: string, images: string[]) {
    await tx.productImage.deleteMany({ where: { productId } });
    if (images.length) await tx.productImage.createMany({ data: images.map((url, position) => ({ productId, url, position })) });
  }

  const load = (db: Prisma.TransactionClient | PrismaClient, id: string) => db.product.findUnique({ where: { id }, include: productInclude });

  function describeChanges(before: ProductRow, after: ProductRow): string {
    const parts: string[] = [];
    if (before.status !== after.status) parts.push(`visibility ${before.status.toLowerCase()} → ${after.status.toLowerCase()}`);
    for (const v of after.variants) {
      const b = before.variants.find((x) => x.id === v.id);
      if (b && !b.price.equals(v.price)) parts.push(`${v.label || "price"} ${inr(Number(b.price))} → ${inr(Number(v.price))}`);
    }
    if (before.name !== after.name) parts.push("name");
    return parts.length ? parts.join("; ") : "details";
  }

  return {
    async listPublic() {
      const rows = await prisma.product.findMany({ where: { status: "ACTIVE" }, include: productInclude, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
      return rows.map(toPublicProduct);
    },
    async getPublic(idOrSlug: string) {
      const row = await prisma.product.findFirst({ where: { status: "ACTIVE", OR: [{ id: idOrSlug }, { slug: idOrSlug }] }, include: productInclude });
      if (!row) throw notFound("This product isn't available.");
      return toPublicProduct(row);
    },
    async listAdmin() {
      const rows = await prisma.product.findMany({ include: productInclude, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
      return rows.map(toAdminProduct);
    },
    async getAdmin(id: string) {
      const row = await load(prisma, id);
      if (!row) throw notFound("Product not found.");
      return toAdminProduct(row);
    },

    async create(input: CreateProductInput, actor: Actor) {
      checkRules(input.status, input.variants);
      const row = await prisma.$transaction(async (tx) => {
        const id = input.id ?? `p-${randomUUID()}`;
        if (await tx.product.findUnique({ where: { id }, select: { id: true } })) throw conflict("A product with this id already exists.");
        await ensureSlugFree(tx, input.slug);
        const last = await tx.product.aggregate({ _max: { sortOrder: true } });
        await tx.product.create({
          data: {
            id,
            slug: input.slug,
            name: input.name,
            categoryId: await categoryId(tx, input.category),
            collection: input.collection ?? null,
            shortDescription: input.shortDescription,
            description: input.description,
            directions: input.directions,
            ingredients: input.ingredients,
            keyIngredients: json(input.keyIngredients),
            details: input.details,
            benefits: json(input.benefits),
            concerns: json(input.concerns),
            relatedSlugs: json(input.relatedSlugs),
            shape: input.shape,
            tint: input.tint,
            featured: input.featured,
            bestSeller: input.bestSeller,
            status: STATUS[input.status],
            archivedAt: input.status === "archived" ? new Date() : null,
            sourceUrl: input.sourceUrl ?? null,
            sortOrder: (last._max.sortOrder ?? 0) + 1,
          },
        });
        await writeVariants(tx, id, input.variants, []);
        await writeImages(tx, id, input.images);
        await logActivity(tx, actor, { action: "product.create", entityType: "product", entityId: id, summary: `Created ${input.name} (${input.status})` });
        return load(tx, id);
      });
      return toAdminProduct(row!);
    },

    async update(id: string, input: UpdateProductInput, actor: Actor) {
      const row = await prisma.$transaction(async (tx) => {
        const before = await load(tx, id);
        if (!before) throw notFound("Product not found.");
        const nextStatus = input.status ?? (before.status.toLowerCase() as "active" | "draft" | "archived");
        const nextVariants: VariantInput[] = input.variants ?? before.variants.map((v) => ({ id: v.id, label: v.label, kind: v.kind === "SHADE" ? "shade" : "size", price: Number(v.price), compareAtPrice: v.compareAtPrice == null ? null : Number(v.compareAtPrice) }));
        checkRules(nextStatus, nextVariants);
        if (input.slug && input.slug !== before.slug) await ensureSlugFree(tx, input.slug, id);
        const data: Prisma.ProductUpdateInput = {};
        if (input.slug !== undefined) data.slug = input.slug;
        if (input.name !== undefined) data.name = input.name;
        if (input.category !== undefined) data.category = { connect: { id: await categoryId(tx, input.category) } };
        if (input.collection !== undefined) data.collection = input.collection;
        if (input.shortDescription !== undefined) data.shortDescription = input.shortDescription;
        if (input.description !== undefined) data.description = input.description;
        if (input.directions !== undefined) data.directions = input.directions;
        if (input.ingredients !== undefined) data.ingredients = input.ingredients;
        if (input.keyIngredients !== undefined) data.keyIngredients = json(input.keyIngredients);
        if (input.details !== undefined) data.details = input.details;
        if (input.benefits !== undefined) data.benefits = json(input.benefits);
        if (input.concerns !== undefined) data.concerns = json(input.concerns);
        if (input.relatedSlugs !== undefined) data.relatedSlugs = json(input.relatedSlugs);
        if (input.shape !== undefined) data.shape = input.shape;
        if (input.tint !== undefined) data.tint = input.tint;
        if (input.featured !== undefined) data.featured = input.featured;
        if (input.bestSeller !== undefined) data.bestSeller = input.bestSeller;
        if (input.sourceUrl !== undefined) data.sourceUrl = input.sourceUrl;
        if (input.status !== undefined) {
          data.status = STATUS[input.status];
          data.archivedAt = input.status === "archived" ? (before.archivedAt ?? new Date()) : null;
        }
        await tx.product.update({ where: { id }, data });
        if (input.variants) await writeVariants(tx, id, input.variants, before.variants);
        if (input.images) await writeImages(tx, id, input.images);
        const after = (await load(tx, id))!;
        await logActivity(tx, actor, { action: "product.update", entityType: "product", entityId: id, summary: `Updated ${after.name}: ${describeChanges(before, after)}` });
        return after;
      });
      return toAdminProduct(row);
    },

    /** "Delete" from admin archives the product (hidden, kept for order history). */
    async archive(id: string, actor: Actor) {
      const row = await prisma.$transaction(async (tx) => {
        const before = await tx.product.findUnique({ where: { id } });
        if (!before) throw notFound("Product not found.");
        await tx.product.update({ where: { id }, data: { status: "ARCHIVED", archivedAt: before.archivedAt ?? new Date() } });
        await logActivity(tx, actor, { action: "product.archive", entityType: "product", entityId: id, summary: `Archived ${before.name} (hidden from the shop)` });
        return load(tx, id);
      });
      return toAdminProduct(row!);
    },

    /** Permanent delete is only for hidden products that were never ordered. */
    async destroy(id: string, actor: Actor) {
      await prisma.$transaction(async (tx) => {
        const p = await tx.product.findUnique({ where: { id } });
        if (!p) throw notFound("Product not found.");
        if (p.status === "ACTIVE") throw conflict("Hide or archive the product before deleting it permanently.");
        if ((await tx.orderItem.count({ where: { productId: id } })) > 0) throw conflict("This product has orders, so it can only be archived.");
        await tx.product.delete({ where: { id } });
        await logActivity(tx, actor, { action: "product.delete", entityType: "product", entityId: id, summary: `Permanently deleted ${p.name}` });
      });
    },

    categories: () => prisma.category.findMany({ orderBy: { position: "asc" }, select: { slug: true, name: true, tagline: true, description: true } }),
  };
}
export type ProductService = ReturnType<typeof createProductService>;
