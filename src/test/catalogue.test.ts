import { describe, expect, it } from "vitest";

import { comboSlugs, deTanSlugs, productConcerns } from "@/lib/concerns";
import { products } from "@/lib/mock-data";

const bySlug = (s: string) => products.find((p) => p.slug === s)!;

describe("real catalogue", () => {
  it("imports all 20 products from the original site", () => expect(products).toHaveLength(20));
  it("has no sample products left", () => expect(products.every((p) => !p.isSample)).toBe(true));
  it("keeps Tomato Face Wash at the listed ₹380 (MRP ₹390)", () => {
    const v = bySlug("tomato-face-wash").variants[0]!;
    expect([v.price, v.compareAtPrice]).toEqual([380, 390]);
  });
  it("offers six lipstick shades", () => expect(bySlug("liquid-matte-lipstick").variants).toHaveLength(6));
  it("maps sunscreen to Sun Protection", () => expect(productConcerns.sunscreen).toContain("sun-protection"));
  it("every concern/collection slug exists in the catalogue", () => {
    const slugs = [...Object.keys(productConcerns), ...deTanSlugs, ...comboSlugs];
    expect(slugs.every((s) => products.some((p) => p.slug === s))).toBe(true);
  });
});
