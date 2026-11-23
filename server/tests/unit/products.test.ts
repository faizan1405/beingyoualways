// Pure unit tests (no database).
import { describe, expect, it } from "vitest";

import { toPublicProduct, type ProductRow } from "../../src/lib/productDto.js";
import { createProductInput, imageUrl, productRuleProblems } from "../../src/lib/productSchema.js";
import { Prisma } from "@prisma/client";

describe("product input rules", () => {
  it("rejects browser-only data-URL photos until Hostinger media storage is connected", () => {
    const r = imageUrl.safeParse("data:image/webp;base64,AAAA");
    expect(r.success).toBe(false);
    expect(imageUrl.safeParse("asset:products/gallery/face-serum/01-hero.webp").success).toBe(true);
    expect(imageUrl.safeParse("https://media.beingyoualways.com/p/1.webp").success).toBe(true);
    expect(imageUrl.safeParse("http://insecure.example/1.webp").success).toBe(false);
  });
  it("a visible product needs a selling price for every size or shade", () => {
    expect(productRuleProblems({ status: "active", variants: [{ label: "50 ml", price: 0 }] })).toHaveLength(1);
    expect(productRuleProblems({ status: "draft", variants: [{ label: "50 ml", price: 0 }] })).toHaveLength(0);
  });
  it("MRP must be higher than the selling price", () => {
    expect(productRuleProblems({ status: "draft", variants: [{ label: "50 ml", price: 500, compareAtPrice: 500 }] })).toHaveLength(1);
  });
  it("rounds prices to paise and rejects negative prices", () => {
    const ok = createProductInput.parse({ slug: "x-y", name: "Xy", category: "skincare", shortDescription: "", description: "", directions: "", ingredients: [], details: [], shape: "jar", tint: "t", images: [], featured: false, bestSeller: false, status: "draft", variants: [{ label: "a", kind: "size", price: 10.005 }] });
    expect(ok.variants[0]!.price).toBe(10.01);
    expect(createProductInput.safeParse({ ...ok, variants: [{ label: "a", kind: "size", price: -1 }] }).success).toBe(false);
  });
});

describe("public product shape", () => {
  it("never exposes stock counts — only whether a size or shade can be ordered", () => {
    const row = {
      id: "p1", slug: "s", name: "N", categoryId: 1, category: { id: 1, slug: "skincare", name: "", tagline: "", description: "", position: 0 },
      collection: null, shortDescription: "", description: "", directions: "", ingredients: [], keyIngredients: null, details: [], benefits: null, concerns: null, relatedSlugs: null,
      shape: "jar", tint: "t", featured: false, bestSeller: false, status: "ACTIVE", isSample: false, sortOrder: 0, sourceUrl: null, createdAt: new Date(), updatedAt: new Date(), archivedAt: null, images: [],
      variants: [
        { id: "a", productId: "p1", label: "A", kind: "SIZE", price: new Prisma.Decimal(499), compareAtPrice: null, swatch: null, position: 0, inventory: { variantId: "a", quantity: 37, updatedAt: new Date() } },
        { id: "b", productId: "p1", label: "B", kind: "SIZE", price: new Prisma.Decimal(499), compareAtPrice: null, swatch: null, position: 1, inventory: { variantId: "b", quantity: 0, updatedAt: new Date() } },
        { id: "c", productId: "p1", label: "C", kind: "SIZE", price: new Prisma.Decimal(499), compareAtPrice: null, swatch: null, position: 2, inventory: { variantId: "c", quantity: null, updatedAt: new Date() } },
      ],
    } as unknown as ProductRow;
    expect(toPublicProduct(row).variants.map((v) => v.stock)).toEqual([1, 0, 1]);
  });
});
