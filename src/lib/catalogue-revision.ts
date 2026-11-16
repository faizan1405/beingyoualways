// Verified updates applied on top of the catalogue imported from beingyoualways.com.
// Facts here come only from the client's genuine packaging photos or product sheet
// (src/content/product-sheet.ts). Prices, ids and slugs are never changed here.
import type { Product } from "@/lib/types";
import { isUnconfirmed } from "@/lib/variants";
import { catalogueImages, galleryImages } from "@/lib/product-images";

/** Bump when the patches below change, so saved demo data picks them up once. */
export const CATALOGUE_REVISION = "2026-11-real-packs-3";

export interface ProductPatch {
  /** New name, applied only while the product still has the imported name `replacesName`. */
  name?: { to: string; replacesName: string };
  /** Net quantity printed on the pack, replaces a "to be confirmed" size label. */
  size?: string;
  keyIngredients?: string[];
  /** Earlier patched key ingredients that `keyIngredients` replaces (newer pack photo wins). */
  replacesKeyIngredients?: string[];
  /** Full ingredient list as printed on the pack. */
  ingredients?: string[];
  directions?: string;
}

const VITAMIN_E = ["Vitamin E"];

export const productPatches: Record<string, ProductPatch> = {
  // Nov 2026 pack photos (IMG_8266–8297): sizes, key ingredients and directions as printed.
  "tomato-face-wash": { keyIngredients: ["Tomato", "Fruit AHA"], replacesKeyIngredients: ["Fruit AHA"] },
  sunscreen: {
    name: { to: "Moisturizer & Sunscreen SPF 50+ PA+++ – Hydrating formula with no white cast for all-day protection", replacesName: "Sunscreen SPF 50++ – Hydrating formula with no white cast for all-day protection" },
    size: "50 g", keyIngredients: ["Red Algae Extract", "Cactus Water", "Aquaxyl"], replacesKeyIngredients: ["Mexican Ocean Red Algae Extract"],
    directions: "Apply 15 minutes before sun exposure, evenly over the exposed skin. Reapply every 4 hours, or after swimming or cleansing. A patch test is recommended.",
  },
  "hair-mask": { size: "200 g" },
  "face-serum": { size: "30 ml", keyIngredients: ["Mulberry Extract", "Alpha Arbutin 2%", "Niacinamide 3%"] },
  "aloe-vera-gel": {
    size: "200 g", keyIngredients: ["Vitamin E", "Tea Tree Oil"],
    ingredients: ["Aqua", "Aloe Barbadensis Leaf Extract", "Vitamin E", "Glycerin", "Carbomer", "Sodium Benzoate"],
    directions: "Dispense onto the palm of your hand and apply liberally to the skin or hair.",
  },
  "face-wash": {
    size: "100 ml", keyIngredients: ["Daisy Flower Extract", "ProVitamin B5", "Niacinamide", "Aloe Vera"], replacesKeyIngredients: ["Daisy Flower Extract"],
    directions: "Dampen your face with lukewarm water. Massage a small amount in gentle circular motions, then rinse well and pat dry.",
  },
  toner: { keyIngredients: ["Fennel Extract", "Niacinamide"] },
  "face-mask": { keyIngredients: ["Mexican Cactus Extract"], directions: "Application time: 10 minutes for women, 15–20 minutes for men.\nNo peeling required." },
  "hair-oil": { size: "110 ml", keyIngredients: ["Organic Moringa Oil", "Pumpkin Seed Oil", "Olive Oil"], directions: "No hair wash required after application." },
  shampoo: {
    size: "200 ml", keyIngredients: ["Fruit AHAs", "ProVitamin B5", "Aloe Vera", "Lavender Oil"], replacesKeyIngredients: ["Canadian Maple Tree Extract"],
    directions: "Wet your hair. Rub a small amount between your palms and massage into the roots, then down to the tips. Rinse thoroughly with lukewarm water.",
  },
  "herbal-wax-powder": { keyIngredients: ["Green Apple Extract"], directions: "Apply against hair growth, wait 15 minutes, wipe with a wet cloth, then rinse." },
  "volcanic-scrub": { keyIngredients: ["Korean Volcanic Sand"], directions: "Use twice a week. Suitable for both face and body." },
  "liquid-matte-lipstick": { keyIngredients: VITAMIN_E },
  kajal: { keyIngredients: VITAMIN_E },
  mascara: { keyIngredients: VITAMIN_E },
  "eyebrow-definer": { keyIngredients: VITAMIN_E },
  "true-base-liquid-foundation": { keyIngredients: VITAMIN_E },
  "bright-banana-powder": { keyIngredients: VITAMIN_E },
};

/** Products whose gallery gained a genuine packshot in an earlier revision (main photo first). */
export const rephotographed = ["tomato-face-wash", "sunscreen", "hair-mask", "face-serum", "aloe-vera-gel"];
/** Saved galleries are refreshed once when the product has a new photo set (four-image gallery or packshot). */
const refreshesGallery = (slug: string) => rephotographed.includes(slug) || galleryImages(slug).length > 0;

const sameList = (a: string[] | undefined, b: string[] | undefined) => !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]);

export function applyPatch(p: Product): Product {
  const x = productPatches[p.slug];
  if (!x) return p;
  return {
    ...p,
    name: x.name && p.name === x.name.replacesName ? x.name.to : p.name,
    keyIngredients: !p.keyIngredients || sameList(p.keyIngredients, x.replacesKeyIngredients) ? (x.keyIngredients ?? p.keyIngredients) : p.keyIngredients,
    ingredients: p.ingredients.length ? p.ingredients : (x.ingredients ?? []),
    directions: x.directions && isUnconfirmed(p.directions) ? x.directions : p.directions,
    variants: x.size && p.variants.length === 1
      ? p.variants.map((v) => (v.kind === "size" && isUnconfirmed(v.label) ? { ...v, label: x.size! } : v))
      : p.variants,
  };
}

/** Client product with no price, size or photo yet: hidden draft, never purchasable (₹0, no stock). */
export const magicDropDraft: Product = {
  id: "bya-draft-magic-drop",
  slug: "magic-drop",
  name: "Magic Drop",
  category: "colour-cosmetics",
  shortDescription: "Fortified with Vitamin E for added hydration.",
  description: "Fortified with Vitamin E for added hydration.\nEnhances makeup longevity and creates a smooth base.\nProvides a radiant, glowing finish.",
  ingredients: [],
  keyIngredients: ["Vitamin E"],
  directions: "Directions to be confirmed by the client.",
  details: [],
  variants: [{ id: "magic-drop-1", label: "Size to be confirmed", kind: "size", price: 0, stock: 0 }],
  shape: "bottle",
  tint: "oklch(0.6 0.12 20)",
  images: [],
  featured: false,
  bestSeller: false,
  concerns: [],
  status: "draft",
  isSample: false,
};

/**
 * All Season Body Lotion — new in the Nov 2026 pack photos, not on the original site.
 * Hidden draft: no agreed selling price (the pack's MRP is not a price decision) and the
 * pack's size is contradictory (front 100 ml, back MRP per ml implies 300 ml).
 */
export const bodyLotionDraft: Product = {
  id: "bya-draft-body-lotion",
  slug: "all-season-body-lotion",
  name: "All Season Body Lotion",
  category: "skincare",
  shortDescription: "Soft, smooth, nourished skin in every season — with natural plant extracts.",
  description: "An all-season body lotion with Sea Buckthorn Oil, Licorice (Mulethi) Root Extract and Shea Butter.\nSoftens and smooths, and keeps skin nourished.\nFor all skin types. Sulfate free.",
  ingredients: [],
  keyIngredients: ["Sea Buckthorn Oil", "Licorice (Mulethi) Root Extract", "Shea Butter"],
  directions: "Apply generously to clean, dry skin and massage gently until fully absorbed. Use daily, or as often as needed.",
  details: [],
  variants: [{ id: "all-season-body-lotion-1", label: "Size to be confirmed", kind: "size", price: 0, stock: 0 }],
  shape: "bottle",
  tint: "oklch(0.62 0.1 60)",
  images: catalogueImages("all-season-body-lotion"),
  featured: false,
  bestSeller: false,
  concerns: [],
  status: "draft",
  isSample: false,
};

/** Products created by these revisions (added to saved demo data once). */
export const addedProducts = [magicDropDraft, bodyLotionDraft];

const hasUpload = (p: Product) => (p.images ?? []).some((src) => src.startsWith("data:"));

/**
 * Upgrade demo data saved in a browser before this revision without wiping admin edits:
 * only fills facts that are still empty / "to be confirmed", refreshes galleries the admin
 * hasn't uploaded to, and adds new draft products. Prices, stock and flags are untouched.
 */
export function reviseStored(stored: Product[], seed: Product[]): Product[] {
  const out = stored.map((p) => {
    const s = seed.find((x) => x.id === p.id);
    if (!s || !(p.slug in productPatches || refreshesGallery(p.slug))) return p;
    const next = applyPatch(p);
    return refreshesGallery(p.slug) && !hasUpload(p) ? { ...next, images: s.images } : next;
  });
  for (const a of addedProducts) if (!out.some((p) => p.id === a.id || p.slug === a.slug)) out.push(structuredClone(a));
  return out;
}
