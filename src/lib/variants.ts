// Variant + product-information rules shared by product pages, cards and the bag.
import type { Product, ProductVariant } from "@/lib/types";

/** Labels/text imported as "to be confirmed" are not verified facts and are never shown as real values. */
export const isUnconfirmed = (s: string | undefined | null) => !s || !s.trim() || /to be confirmed/i.test(s);

/** A shopper must actively pick a variant when the product has more than one. */
export const requiresChoice = (p: Product) => p.variants.length > 1;

export const variantKindLabel = (p: Product) => (p.variants[0]?.kind === "shade" ? "shade" : "size");

/** Human label like "Shade: Dusty Rose" or "Size: 100 ml"; null when the label isn't verified. */
export function variantText(v: ProductVariant): string | null {
  if (isUnconfirmed(v.label)) return null;
  return `${v.kind === "shade" ? "Shade" : "Size"}: ${v.label}`;
}

/** Variant pre-selected on load: only when there is nothing to choose. */
export const initialVariantId = (p: Product): string | null => (requiresChoice(p) ? null : (p.variants[0]?.id ?? null));

export type VariantCheck = { ok: true; variant: ProductVariant } | { ok: false; error: string };

/** Validate the shopper's variant choice before anything is added to the bag. */
export function checkVariant(p: Product, variantId: string | null): VariantCheck {
  const kind = variantKindLabel(p);
  if (!variantId) return { ok: false, error: `Please choose a ${kind} before adding to your bag.` };
  const v = p.variants.find((x) => x.id === variantId);
  if (!v) return { ok: false, error: `That ${kind} isn't available for this product.` };
  if (v.stock <= 0) return { ok: false, error: `This ${kind} is currently unavailable.` };
  return { ok: true, variant: v };
}

/**
 * Availability wording. Stock in this prototype is demo data, so we never show
 * counts like "Only 3 left" — only whether the item can be ordered.
 */
export const availabilityOf = (v: ProductVariant | undefined | null) =>
  !v ? null : v.stock > 0 ? ({ ok: true, label: "Available to order" } as const) : ({ ok: false, label: "Currently unavailable" } as const);

/** Verified MRP: only shown when the original site listed a higher regular price. */
export const mrpOf = (v: ProductVariant | undefined | null) =>
  v?.compareAtPrice && v.compareAtPrice > v.price ? v.compareAtPrice : null;

/** Detail rows kept for admin reference only (raw tags from the old site aren't verified claims). */
const INTERNAL_DETAIL_LABELS = new Set(["Original site tags"]);

/** Public product information sections — sections without verified content are omitted. */
export function productInfoSections(p: Product) {
  return {
    description: isUnconfirmed(p.description) ? null : p.description,
    ingredients: p.ingredients.filter((i) => !isUnconfirmed(i)),
    directions: isUnconfirmed(p.directions) ? null : p.directions,
    details: p.details.filter((d) => !isUnconfirmed(d.value) && !INTERNAL_DETAIL_LABELS.has(d.label)),
  };
}
