import { z } from "zod";

export const CATEGORY_SLUGS = ["skincare", "haircare", "colour-cosmetics"] as const;
export const SHAPES = ["bottle", "jar", "tube", "dropper", "lipstick", "compact"] as const;
const ID = /^[A-Za-z0-9_-]{2,64}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Bundled catalogue photo reference, or an https URL served from Hostinger storage.
const ASSET_REF = /^asset:products\/[a-z0-9][a-z0-9/._-]*\.webp$/;

const text = (max: number) => z.string().trim().max(max);
const list = (maxItems: number, maxLen: number) => z.array(text(maxLen)).max(maxItems);
const money = z.number().finite().min(0).max(1_000_000).transform((n) => Math.round(n * 100) / 100);

export const imageUrl = z
  .string()
  .max(1024)
  .refine((u) => !u.startsWith("data:"), "Photo uploads to Hostinger storage are not connected yet — choose an existing catalogue photo.")
  .refine((u) => ASSET_REF.test(u) || /^https:\/\/[^\s]+$/.test(u), "Photos must be a catalogue photo or an https address.");

export const variantInput = z.object({
  id: z.string().regex(ID, "Invalid size/shade id").optional(),
  label: text(120),
  kind: z.enum(["size", "shade"]),
  price: money,
  compareAtPrice: money.nullable().optional(),
  stock: z.number().int().min(0).max(1_000_000).nullable().optional(),
  /** false = stock not counted yet (cannot be ordered until counted). */
  stockTracked: z.boolean().optional(),
  swatch: text(60).nullable().optional(),
});

export const productFields = {
  slug: z.string().max(191).regex(SLUG, "Web address may only use lowercase letters, numbers and dashes"),
  name: text(200).min(2, "Product name is required."),
  category: z.enum(CATEGORY_SLUGS),
  collection: text(120).nullable().optional(),
  shortDescription: text(2000),
  description: text(20_000),
  directions: text(5_000),
  ingredients: list(200, 300),
  keyIngredients: list(50, 200).nullable().optional(),
  details: z.array(z.object({ label: text(100), value: text(500) })).max(50),
  benefits: list(30, 300).nullable().optional(),
  concerns: z.array(z.string().regex(SLUG)).max(30).nullable().optional(),
  relatedSlugs: z.array(z.string().regex(SLUG)).max(20).nullable().optional(),
  shape: z.enum(SHAPES),
  tint: text(60),
  images: z.array(imageUrl).max(20),
  featured: z.boolean(),
  bestSeller: z.boolean(),
  status: z.enum(["active", "draft", "archived"]),
  sourceUrl: z.string().url().max(500).nullable().optional(),
  variants: z.array(variantInput).min(1, "Add at least one size or shade.").max(50),
};

export const createProductInput = z.object({ id: z.string().regex(ID).optional(), ...productFields }).strip();
export const updateProductInput = z.object(productFields).partial().strip();
export type CreateProductInput = z.infer<typeof createProductInput>;
export type UpdateProductInput = z.infer<typeof updateProductInput>;
export type VariantInput = z.infer<typeof variantInput>;

/** Shop rules checked on the final product (same rules as the admin editor). */
export function productRuleProblems(p: { status: string; variants: { label: string; price: number; compareAtPrice?: number | null | undefined }[] }): string[] {
  const e: string[] = [];
  if (p.variants.some((v) => !v.label.trim())) e.push("Each size or shade needs a label.");
  if (p.status === "active" && p.variants.some((v) => !(v.price > 0))) e.push("A product visible in the shop needs a selling price for every size or shade — or keep it hidden.");
  if (p.variants.some((v) => v.compareAtPrice != null && v.compareAtPrice <= v.price)) e.push("MRP must be higher than the selling price — or leave it blank.");
  return e;
}
