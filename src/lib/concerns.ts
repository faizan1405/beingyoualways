// Concern & collection mapping for the sample catalogue.
// Only map a product when its (sample) description supports it — never invent products to fill a concern.

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
  { slug: "tan-removal", name: "Tan Removal", blurb: "De-tan care to refresh sun-dulled skin." },
];

/** product slug → concerns. Sample mapping — confirm per real product before launch. */
export const productConcerns: Record<string, ConcernSlug[]> = {
  "kumkumadi-face-oil": ["pigmentation", "dull-dry-skin"],
  "green-tea-gel-cleanser": ["acne-prone-skin"],
  "saffron-night-cream": ["dull-dry-skin"],
  "rose-dew-face-serum": ["dull-dry-skin"],
  "bhringraj-hair-oil": ["hair-fall"],
  "reetha-shikakai-shampoo": ["dandruff"],
};

/** De-Tan Care products (none in the sample catalogue yet). */
export const deTanSlugs: string[] = [];
/** Combo / bundle products (none in the sample catalogue yet). */
export const comboSlugs: string[] = [];

export const getConcern = (slug: string) => concerns.find((c) => c.slug === slug) ?? null;
