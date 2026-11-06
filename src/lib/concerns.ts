// Concern & collection mapping for the real catalogue (beingyoualways.com, Nov 2026).
// Only map a product when its own name/description supports it — never invent products to fill a concern.

export type ConcernSlug =
  | "pigmentation" | "acne-prone-skin" | "dull-dry-skin" | "dark-circles"
  | "sun-protection" | "hair-fall" | "dandruff" | "tan-removal";

export const concerns: { slug: ConcernSlug; name: string; blurb: string }[] = [
  { slug: "pigmentation", name: "Pigmentation", blurb: "Care for dark spots and uneven-looking tone." },
  { slug: "acne-prone-skin", name: "Acne-Prone Skin", blurb: "Gentle routines for skin that breaks out easily." },
  { slug: "dull-dry-skin", name: "Dull / Dry Skin", blurb: "Hydration and radiance for tired-looking skin." },
  { slug: "dark-circles", name: "Dark Circles", blurb: "Soothing care for the delicate under-eye area." },
  { slug: "sun-protection", name: "Sun Protection", blurb: "Everyday defence for skin under the Indian sun." },
  { slug: "hair-fall", name: "Hair Fall", blurb: "Nourishing care for thinning, breaking hair." },
  { slug: "dandruff", name: "Dandruff", blurb: "Cleansing, calming care for a flaky scalp." },
  { slug: "tan-removal", name: "Tan Removal", blurb: "De-tan care to refr/**
 * product slug → concerns, based on each product's own name/description on the original site.
 * The original site tags most products with "Dark Circles" without support in the copy — not mirrored here.
 */
export const productConcerns: Record<string, ConcernSlug[]> = {
  "face-serum": ["pigmentation", "dull-dry-skin"],
  "face-wash": ["acne-prone-skin", "dull-dry-skin"],
  "aloe-vera-gel": ["dull-dry-skin"],
  sunscreen: ["sun-protection"],
  "hair-oil": ["hair-fall"],
  shampoo: ["hair-fall", "dandruff"],
  "tomato-face-wash": ["tan-removal"],
  "face-mask": ["tan-removal"],
  "volcanic-scrub": ["tan-removal"],
};

/** De-Tan Care — products the original site lists under "De-Tan Care". */
export const deTanSlugs: string[] = ["tomato-face-wash", "volcanic-scrub", "face-mask"];
/** Combos / bundles listed on the original site. */
export const comboSlugs: string[] = ["wax-powder-aloe-vera-gel-combo"];

 comboSlugs: string[] = [];

export const getConcern = (slug: string) => concerns.find((c) => c.slug === slug) ?? null;
