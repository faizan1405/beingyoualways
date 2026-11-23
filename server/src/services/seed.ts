import { Prisma, type PrismaClient } from "@prisma/client";

import { PERMISSIONS, ROLES } from "../lib/permissions.js";

// Snapshot of the storefront's verified catalogue (server/prisma/seed/catalogue.json).
export interface SeedVariant { id: string; label: string; kind: "size" | "shade"; price: number; compareAtPrice?: number; swatch?: string }
export interface SeedProduct {
  id: string; slug: string; name: string; category: string; collection?: string; shortDescription: string; description: string;
  ingredients: string[]; keyIngredients?: string[]; directions: string; details: { label: string; value: string }[];
  variants: SeedVariant[]; shape: string; tint: string; images?: string[]; featured: boolean; bestSeller?: boolean;
  concerns?: string[]; status: "active" | "draft" | "archived"; sourceUrl?: string; benefits?: string[]; relatedSlugs?: string[];
}
export interface SeedCatalogue { categories: { slug: string; name: string; tagline: string; description: string }[]; products: SeedProduct[] }

const STATUS = { active: "ACTIVE", draft: "DRAFT", archived: "ARCHIVED" } as const;
const json = (v: unknown) => (v == null ? Prisma.DbNull : (v as Prisma.InputJsonValue));

/**
 * Idempotent: roles/permissions are synced; categories upserted; catalogue products are only
 * created when missing (by id or web address) — existing products and admin edits are never
 * overwritten, and no customers, orders or payments are created.
 */
export async function seedDatabase(prisma: PrismaClient, catalogue: SeedCatalogue) {
  const report = { permissions: 0, roles: 0, categories: 0, productsCreated: 0, productsSkipped: [] as string[] };

  for (const [key, description] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({ where: { key }, create: { key, description }, update: { description } });
    report.permissions++;
  }
  for (const [key, role] of Object.entries(ROLES)) {
    const r = await prisma.role.upsert({ where: { key }, create: { key, name: role.name }, update: { name: role.name } });
    const perms = await prisma.permission.findMany({ where: { key: { in: role.permissions } } });
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: r.id } }),
      prisma.rolePermission.createMany({ data: perms.map((p) => ({ roleId: r.id, permissionId: p.id })) }),
    ]);
    report.roles++;
  }
  for (const [position, c] of catalogue.categories.entries()) {
    await prisma.category.upsert({ where: { slug: c.slug }, create: { ...c, position }, update: { name: c.name, tagline: c.tagline, description: c.description, position } });
    report.categories++;
  }

  for (const [sortOrder, p] of catalogue.products.entries()) {
    const exists = await prisma.product.findFirst({ where: { OR: [{ id: p.id }, { slug: p.slug }] }, select: { id: true } });
    if (exists) { report.productsSkipped.push(p.slug); continue; }
    const category = await prisma.category.findUnique({ where: { slug: p.category } });
    if (!category) throw new Error(`Seed: unknown category ${p.category} for ${p.slug}`);
    await prisma.$transaction(async (tx) => {
      await tx.product.create({
        data: {
          id: p.id, slug: p.slug, name: p.name, categoryId: category.id, collection: p.collection ?? null,
          shortDescription: p.shortDescription, description: p.description, directions: p.directions,
          ingredients: p.ingredients, keyIngredients: json(p.keyIngredients), details: p.details,
          benefits: json(p.benefits), concerns: json(p.concerns), relatedSlugs: json(p.relatedSlugs),
          shape: p.shape, tint: p.tint, featured: p.featured, bestSeller: p.bestSeller ?? false,
          status: STATUS[p.status], isSample: false, sourceUrl: p.sourceUrl ?? null, sortOrder,
        },
      });
      for (const [position, v] of p.variants.entries()) {
        await tx.productVariant.create({
          data: {
            id: v.id, productId: p.id, label: v.label, kind: v.kind === "shade" ? "SHADE" : "SIZE", price: v.price,
            compareAtPrice: v.compareAtPrice ?? null, swatch: v.swatch ?? null, position,
            // Prototype stock figures are demo values, so real stock starts "not counted".
            inventory: { create: { quantity: null } },
          },
        });
      }
      if (p.images?.length) await tx.productImage.createMany({ data: p.images.map((url, position) => ({ productId: p.id, url, position, alt: p.name })) });
    });
    report.productsCreated++;
  }
  return report;
}
