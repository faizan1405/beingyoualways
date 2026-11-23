import type { Category, Inventory, Prisma, Product, ProductImage, ProductVariant } from "@prisma/client";

// Shapes match the storefront's Product type (src/lib/types.ts) so pages don't change.
export type ProductRow = Product & { category: Category; variants: (ProductVariant & { inventory: Inventory | null })[]; images: ProductImage[] };

export const productInclude = {
  category: true,
  variants: { orderBy: { position: "asc" }, include: { inventory: true } },
  images: { orderBy: { position: "asc" } },
} satisfies Prisma.ProductInclude;

const strings = (v: unknown): string[] | undefined => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined);
const num = (d: Prisma.Decimal | null) => (d == null ? undefined : Number(d));
const status = (s: Product["status"]) => s.toLowerCase() as "active" | "draft" | "archived";

function base(p: ProductRow) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category.slug,
    ...(p.collection ? { collection: p.collection } : {}),
    shortDescription: p.shortDescription,
    description: p.description,
    ingredients: strings(p.ingredients) ?? [],
    ...(strings(p.keyIngredients) ? { keyIngredients: strings(p.keyIngredients) } : {}),
    directions: p.directions,
    details: Array.isArray(p.details) ? (p.details as { label: string; value: string }[]) : [],
    shape: p.shape,
    tint: p.tint,
    images: p.images.map((i) => i.url),
    featured: p.featured,
    bestSeller: p.bestSeller,
    ...(strings(p.concerns) ? { concerns: strings(p.concerns) } : {}),
    status: status(p.status),
    isSample: p.isSample,
    ...(p.sourceUrl ? { sourceUrl: p.sourceUrl } : {}),
    ...(strings(p.benefits) ? { benefits: strings(p.benefits) } : {}),
    ...(strings(p.relatedSlugs) ? { relatedSlugs: strings(p.relatedSlugs) } : {}),
  };
}

const variantBase = (v: ProductVariant) => ({
  id: v.id,
  label: v.label,
  kind: v.kind === "SHADE" ? ("shade" as const) : ("size" as const),
  price: Number(v.price),
  ...(num(v.compareAtPrice) !== undefined ? { compareAtPrice: num(v.compareAtPrice) } : {}),
  ...(v.swatch ? { swatch: v.swatch } : {}),
});

/** Units that can still be ordered: counted stock minus units held by unpaid online orders. Uncounted = 0. */
export const orderableUnits = (inv: Inventory | null) => (inv?.quantity == null ? 0 : Math.max(0, inv.quantity - inv.reserved));

/**
 * Public shape. Stock counts are never exposed: `stock` is 1 when the size/shade can be
 * ordered and 0 when it can't (sold out, or stock not counted yet — uncounted stock is not orderable).
 */
export const toPublicProduct = (p: ProductRow) => ({
  ...base(p),
  variants: p.variants.map((v) => ({ ...variantBase(v), stock: orderableUnits(v.inventory) > 0 ? 1 : 0, ...(v.inventory?.quantity == null ? { notStocked: true } : {}) })),
});

/** Admin shape: real counted quantity, whether it has been counted, and units held by unpaid online orders. */
export const toAdminProduct = (p: ProductRow) => ({
  ...base(p),
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
  variants: p.variants.map((v) => ({ ...variantBase(v), stock: v.inventory?.quantity ?? 0, stockTracked: v.inventory?.quantity != null, reserved: v.inventory?.reserved ?? 0 })),
});
