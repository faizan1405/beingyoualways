import { describe, expect, it } from "vitest";

import { products } from "@/lib/mock-data";
import { MAX_QTY_PER_LINE, clampQty, roomLeft, summarize } from "@/lib/pricing";
import { availabilityOf, checkVariant, initialVariantId, mrpOf, productInfoSections, variantText } from "@/lib/variants";
import { recommendByConcern } from "@/services/productService";

const bySlug = (s: string) => products.find((p) => p.slug === s)!;

describe("pricing", () => {
  it("adds up line totals from price × quantity", () => {
    const s = summarize([{ price: 299, quantity: 2 }, { price: 680, quantity: 1 }], { shippingConfirmed: false });
    expect(s.subtotal).toBe(1278);
    expect(s.itemCount).toBe(3);
  });
  it("shows no payable total while shipping is unconfirmed", () => {
    const s = summarize([{ price: 380, quantity: 1 }], { shippingConfirmed: false });
    expect(s.shipping).toEqual({ state: "pending" });
    expect(s.total).toBeNull();
  });
  it("includes sample shipping in the total once rates are confirmed", () => {
    expect(summarize([{ price: 380, quantity: 1 }], { shippingConfirmed: true }).total).toBe(459);
    expect(summarize([{ price: 500, quantity: 2 }], { shippingConfirmed: true }).total).toBe(1000);
  });
  it("limits one item to 10 units", () => {
    expect(MAX_QTY_PER_LINE).toBe(10);
    expect(clampQty(25)).toBe(10);
    expect(clampQty(0)).toBe(1);
    expect(roomLeft(8)).toBe(2);
    expect(roomLeft(10)).toBe(0);
  });
});

describe("variants", () => {
  it("does not pre-select a shade when there are several", () => {
    expect(initialVariantId(bySlug("liquid-matte-lipstick"))).toBeNull();
    expect(initialVariantId(bySlug("true-base-liquid-foundation"))).toBeNull();
  });
  it("blocks adding a multi-shade product without a shade", () => {
    const r = checkVariant(bySlug("liquid-matte-lipstick"), null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/choose a shade/i);
  });
  it("accepts a chosen shade", () => {
    const p = bySlug("liquid-matte-lipstick");
    expect(checkVariant(p, p.variants[2]!.id).ok).toBe(true);
  });
  it("auto-selects the only variant of a single-size product", () => {
    const p = bySlug("tomato-face-wash");
    expect(initialVariantId(p)).toBe(p.variants[0]!.id);
  });
  it("blocks a variant with no availability", () => {
    const p = bySlug("tomato-face-wash");
    const out = { ...p, variants: [{ ...p.variants[0]!, stock: 0 }] };
    expect(checkVariant(out, out.variants[0]!.id).ok).toBe(false);
  });
  it("never shows demo stock counts", () => {
    expect(availabilityOf({ ...bySlug("kajal").variants[0]!, stock: 3 })?.label).toBe("Available to order");
  });
  it("hides unconfirmed size labels", () => expect(variantText(bySlug("kajal").variants[0]!)).toBeNull());
  it("shows MRP only when it is higher than the price", () => {
    expect(mrpOf({ ...bySlug("kajal").variants[0]!, price: 380, compareAtPrice: 390 })).toBe(390);
    expect(mrpOf({ ...bySlug("kajal").variants[0]!, price: 380, compareAtPrice: 380 })).toBeNull();
  });
  it("omits unconfirmed directions and empty ingredients", () => {
    const s = productInfoSections(bySlug("face-serum"));
    expect(s.directions).toBeNull();
    expect(s.ingredients).toEqual([]);
  });
});

describe("recommendations", () => {
  it("only recommends products sharing a concern", () => {
    const p = bySlug("tomato-face-wash");
    const r = recommendByConcern(products, p);
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => ["face-mask", "volcanic-scrub"].includes(x.slug))).toBe(true);
  });
  it("recommends nothing for a product without concern tags", () => {
    expect(recommendByConcern(products, bySlug("mascara"))).toEqual([]);
  });
});
