// Client-supplied product sheet ("Being You Always - Product details.docx", Nov 2026),
// copied point-for-point. This is SOURCE information from the client, not verified fact:
// points with a `flag` need substantiation and are never published automatically.
// Supplied packshots that could not be matched with certainty also live here, so the
// admin can review them instead of the site guessing.
import shampoo100 from "@/assets/products/review/shampoo-100ml.webp";
import hairMask100 from "@/assets/products/review/hair-mask-100g.webp";
import aloeTube from "@/assets/products/review/aloe-vera-gel-tube.webp";
import origShampoo from "@/assets/products/originals/shampoo-100ml.png";
import origHairMask100 from "@/assets/products/originals/hair-mask-100g.png";
import origAloeTube from "@/assets/products/originals/aloe-vera-gel-tube-100g-plus-20g.png";

export const PRODUCT_SHEET_SOURCE = "Being You Always - Product details.docx (supplied by the client, Nov 2026)";

/** Flip only when the client sends proof for every flagged statement below. */
export const PRODUCT_SHEET_CLAIMS_CONFIRMED = false;

export type ClaimFlag = "certification" | "availability" | "treatment" | "safety" | "universal" | "performance";

export const claimFlagLabels: Record<ClaimFlag, string> = {
  certification: "Certification — needs a certificate or registration number",
  availability: "International availability — needs confirmation",
  treatment: "Result / treatment claim — needs evidence",
  safety: "Safety claim — needs test evidence",
  universal: "\"All skin types\" — needs evidence",
  performance: "Performance claim (waterproof, SPF, etc.) — needs test evidence",
};

export interface SheetPoint { text: string; flag?: ClaimFlag }
export interface SheetEntry {
  group: string;
  /** Slugs of existing catalogue products this group refers to. */
  matches: string[];
  points: SheetPoint[];
  /** Internal note: discrepancies between the sheet, packaging and listing. */
  note?: string;
}

const FDA: SheetPoint = { text: "FDA approved – quality and safety assured", flag: "certification" };
const DUBAI: SheetPoint = { text: "available in Dubai", flag: "availability" };

export const productSheet: SheetEntry[] = [
  { group: "Face Wash", matches: ["face-wash"], points: [
    { text: "Infused with Daisy Flower Extract" }, { text: "Deeply cleanses facial skin" }, { text: "Brightens complexion" },
    { text: "Provides hydration" }, { text: "Offers antioxidant protection" }, { text: "Promotes skin cell renewal", flag: "treatment" },
    { text: "Sulfate-free" }, FDA,
  ], note: "Matches the Daisy Face Wash listing. Tomato Face Wash is a separate product and is not described in the sheet." },
  { group: "Face Toner", matches: ["toner"], points: [
    { text: "Contains Fennel Extract and Niacinamide" }, { text: "Minimizes the appearance of pores" }, { text: "Enhances skin texture" },
    { text: "Maintains hydration and refreshes skin" }, { text: "Adds a natural glow" }, { text: "Suitable for all skin types", flag: "universal" },
    { text: "Sulfate-free" }, FDA,
  ] },
  { group: "Sunscreen", matches: ["sunscreen"], points: [
    { text: "Enriched with Mexican Ocean Red Algae Extract" }, { text: "Broad Spectrum SPF 50 PA+++", flag: "performance" },
    { text: "Shields against harmful UV rays", flag: "performance" }, { text: "Provides lasting moisture" },
    { text: "Water-resistant formula", flag: "performance" }, { text: "Protects against pollution", flag: "performance" },
    { text: "All-day hydration" }, FDA, DUBAI,
  ], note: "Sheet says \"SPF 50 PA+++\"; the pack prints \"SPF 50+ / PA+++\"; the old listing said \"SPF 50++\". The listing name now follows the pack. Pack net quantity: 50 GM." },
  { group: "Face Serum", matches: ["face-serum"], points: [
    { text: "Contains Mulberry Extract" }, { text: "Anti-aging benefits", flag: "treatment" },
    { text: "Reduces pigmentation and dark circles", flag: "treatment" }, { text: "Minimizes wrinkles and open pores", flag: "treatment" },
    { text: "Enhances facial glow" }, { text: "Provides overnight hydration" }, FDA, DUBAI,
  ], note: "New pack (silver collar) prints Alpha Arbutin 2% and Niacinamide 3%, 30 ml. Older listing photos show a gold-collar bottle — same product name and actives, so treated as a packaging update. The listing name (from the old site) already contains result claims." },
  { group: "Face Mask", matches: ["face-mask"], points: [
    { text: "Designed for detan and skin brightening" }, { text: "Made with Mexican cactus extract" },
    { text: "No peeling required – gentle on the skin", flag: "safety" }, { text: "Application: 10 minutes for women, 15–20 minutes for men" }, FDA, DUBAI,
  ] },
  { group: "Hair Oil", matches: ["hair-oil"], points: [
    { text: "Infused with Organic Moringa Oil" }, { text: "Reduces hair fall and stimulates growth", flag: "treatment" },
    { text: "Blended with Pumpkin Seed and Olive Oil" }, { text: "Non-sticky texture" }, { text: "No hair wash required after application" }, FDA,
  ] },
  { group: "Shampoo", matches: ["shampoo"], points: [
    { text: "Enriched with Canadian Maple Tree Extract" }, { text: "Helps control hair fall", flag: "treatment" },
    { text: "Smoothens hair texture" }, { text: "Free from sulfates and parabens" }, FDA, DUBAI,
  ], note: "The supplied 100 ml photo reads \"plant based AHA clarifying Shampoo with provitamin B5\" and has a different label from the listing photos (maple leaf). Not merged — see photos awaiting confirmation." },
  { group: "Hair Mask", matches: ["hair-mask"], points: [
    { text: "Made with Rice, Flaxseed, and Vegetable Carotene" }, { text: "Nourishes, smoothens, and tames frizz" },
    { text: "Prevents hair damage", flag: "treatment" }, { text: "Safe for scalp application", flag: "safety" }, FDA, DUBAI,
  ], note: "200 GM pack (green, \"Professional Protein Bond Repair Hair Mask\") matches the listing. The red 100 g jar prints \"Flaxseed, Rice, Vegetable Keratin, Olive\" — the sheet says Vegetable Carotene — and no net quantity is visible. Key ingredients withheld until the client confirms." },
  { group: "Herbal Wax Powder", matches: ["herbal-wax-powder", "wax-powder-aloe-vera-gel-combo"], points: [
    { text: "Green Apple Extract-based formula" }, { text: "Painless and irritation-free hair removal", flag: "safety" },
    { text: "Removes unwanted hair and dead skin" }, { text: "Apply against hair growth, wait 15 minutes, wipe with a wet cloth, then rinse" }, FDA, DUBAI,
  ] },
  { group: "Body Scrub", matches: ["volcanic-scrub"], points: [
    { text: "Made from Korean Volcanic Sand" }, { text: "Helps detan and brighten skin" }, { text: "Fine particles ensure gentle exfoliation" },
    { text: "Safe for use twice a week" }, { text: "Suitable for both face and body" }, FDA, DUBAI,
  ] },
  { group: "Aloe Vera Gel", matches: ["aloe-vera-gel", "wax-powder-aloe-vera-gel-combo"], points: [
    { text: "Enriched with Vitamin E and Tea Tree Oil" }, { text: "Hydrates, brightens, and soothes skin" },
    { text: "Can also be applied to hair for softness and dandruff control", flag: "treatment" }, { text: "Non-sticky formula" },
    { text: "Effective for sunburn and skin irritation", flag: "treatment" }, FDA, DUBAI,
  ], note: "200 gms jar (gold lid) matches the listing; its label prints the full ingredient list and directions. The jar label also says \"100% Natural Actives\" and \"Vitamin E, E\" (printed twice). The tube is printed \"100g · 20g FREE\" (grams — the file name said 120 ml)." },
  { group: "Lipstick / Kajal / Mascara / Eyebrow Definer", matches: ["liquid-matte-lipstick", "kajal", "mascara", "eyebrow-definer"], points: [
    { text: "Infused with Vitamin E for added nourishment" }, { text: "Intense color payoff with high pigmentation" },
    { text: "Smudge-proof and long-lasting wear", flag: "performance" }, { text: "Waterproof formula", flag: "performance" }, FDA,
  ], note: "Liquid Eyeliner is not mentioned in the sheet." },
  { group: "Foundation", matches: ["true-base-liquid-foundation"], points: [
    { text: "Enriched with Vitamin E for skin benefits" }, { text: "Suitable for all skin types", flag: "universal" },
    { text: "Delivers a natural, even-toned finish" }, { text: "No cracking or patchiness" }, { text: "Waterproof for all-day wear", flag: "performance" }, FDA,
  ] },
  { group: "Magic Drop", matches: ["magic-drop"], points: [
    { text: "Fortified with Vitamin E for added hydration" }, { text: "Enhances makeup longevity and creates a smooth base" },
    { text: "Waterproof and sweat-resistant", flag: "performance" }, { text: "Provides a radiant, glowing finish" }, FDA,
  ], note: "Not in the imported catalogue. Created as a hidden draft: price, size and photo are missing." },
  { group: "Banana Powder", matches: ["bright-banana-powder"], points: [
    { text: "Vitamin E-enriched formula for skin nourishment" }, { text: "Sets foundation and concealer for extended wear" },
    { text: "Controls oil and reduces shine" }, { text: "Creates a smooth, matte, and flawless look" }, FDA,
  ] },
];

export const sheetFor = (slug: string) => productSheet.filter((e) => e.matches.includes(slug));
export const flaggedPoints = () => productSheet.flatMap((e) => e.points.filter((p) => p.flag).map((p) => ({ group: e.group, ...p })));

export interface PendingPhoto {
  id: string;
  /** Existing product this photo might belong to. */
  slug: string;
  label: string;
  src: string;
  originalUrl: string;
  reason: string;
}

/** Supplied photos whose match is uncertain: never shown to shoppers until the admin adds them. */
export const pendingPhotos: PendingPhoto[] = [
  { id: "shampoo-100ml", slug: "shampoo", label: "Shampoo 100 ml (supplied photo)", src: shampoo100, originalUrl: origShampoo,
    reason: "Label reads \"plant based AHA clarifying Shampoo with provitamin B5, 100 ML\". The current listing photos show a different label (maple leaf) and the product sheet lists Canadian Maple Tree Extract — this may be a new formula, not just new packaging." },
  { id: "hair-mask-100g", slug: "hair-mask", label: "Protein Bond Repair Hair Mask, red jar (file named 100 gm)", src: hairMask100, originalUrl: origHairMask100,
    reason: "Different packaging from the 200 g \"Professional\" pack, no net quantity visible in the photo, and it lists Vegetable Keratin where the product sheet says Vegetable Carotene. Confirm it is the same formula and its price before adding a 100 g size." },
  { id: "aloe-vera-gel-tube", slug: "aloe-vera-gel", label: "Aloe Vera Gel tube, 100 g + 20 g free", src: aloeTube, originalUrl: origAloeTube,
    reason: "Printed \"100g · 20g FREE\" (grams, not 120 ml) and labelled \"with Vitamin E & Tea Tree Oil\"; the current listing is the 200 g jar. Confirm it is the same gel and its price before adding it as a size." },
];
