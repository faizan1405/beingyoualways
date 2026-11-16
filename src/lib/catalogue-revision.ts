// Verified updates applied on top of the catalogue imported from beingyoualways.com.
// Facts here come only from the client's genuine packaging photos or product sheet
// (src/content/product-sheet.ts). Prices, ids and slugs are never changed here.
import type { Product } from "@/lib/types";
import { isUnconfirmed } from "@/lib/variants";
import { galleryImages } from "@/lib/product-images";

/** Bump when the patches below change, so saved demo data picks them up once. */
export const CATALOGUE_REVISION = "2026-11-gallery-4";

export interface ProductPatch {
  /** New name, applied only while the product still has the imported name `replacesName`. */
  name?: { to: string; replacesName: string };
  /** Net quantity printed on the pack, replaces a "to be confirmed" size label. */
  size?: string;
  keyIngredients?: string[];
  /** Full ingredient list as printed on the pack. */
  ingredients?: string[];
  directions?: string;
}

const VITAMIN_E = ["Vitamin E"];

export const productPatches: Record<string, ProductPatch> = {
  "tomato-face-wash": { keyIngredients: ["Fruit AHA"] },
  sunscreen: {
    name: { to: "Moisturizer & Sunscreen SPF 50+ PA+++ – Hydrating formula with no white cast for all-day protection", replacesName: "Sunscreen SPF 50++ – Hydrating formula with no white cast for all-day protection" },
    size: "50 g", keyIngredients: ["Mexican Ocean Red Algae Extract"],
  },
  "hair-mask": { size: "200 g" },
  "face-serum": { size: "30 ml", keyIngredients: ["Mulberry Extract", "Alpha Arbutin 2%", "Niacinamide 3%"] },
  "aloe-vera-gel": {
    size: "200 g", keyIngredients: ["Vitamin E", "Tea Tree Oil"],
    ingredients: ["Aqua", "Aloe Barbadensis Leaf Extract", "Vitamin E", "Glycerin", "Carbomer", "Sodium Benzoate"],
    directions: "Dispense onto the palm of your hand and apply liberally to the skin or hair.",
  },
  "face-wash": { keyIngredients: ["Daisy Flower Extract"] },
  toner: { keyIngredients: ["Fennel Extract", "Niacinamide"] },
  "face-mask": { keyIngredients: ["Mexican Cactus Extract"], directions: "Application time: 10 minutes for women, 15–20 minutes for men.\nNo peeling required." },
  "hair-oil": { keyIngredients: ["Organic Moringa Oil", "Pumpkin Seed Oil", "Olive Oil"], directions: "No hair wash required after application." },
  shampoo: { keyIngredients: ["Canadian Maple Tree Extract"] },
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

export function applyPatch(p: Product): Product {
  const x = productPatches[p.slug];
  if (!x) return p;
  return {
    ...p,
    name: x.name && p.name === x.name.replacesName ? x.name.to : p.name,
    keyIngredients: p.keyIngredients ?? x.keyIngredients,
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

/** Products created by this revision (added to saved demo data once). */
export const addedProducts = [magicDropDraft];

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
