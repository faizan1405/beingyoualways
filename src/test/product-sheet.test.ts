import { describe, expect, it } from "vitest";

import { applyPatch, magicDropDraft, reviseStored } from "@/lib/catalogue-revision";
import { products } from "@/lib/mock-data";
import { checkVariant, productInfoSections } from "@/lib/variants";
import { filterProducts } from "@/services/productService";
import { flaggedPoints, pendingPhotos, productSheet } from "@/content/product-sheet";
import type { Product } from "@/lib/types";

const bySlug = (s: string) => products.find((p) => p.slug === s)!;
const price = (s: string) => { const v = bySlug(s).variants[0]!; return [v.price, v.compareAtPrice]; };

describe("catalogue audit — no duplicates", () => {
  it("has 21 products: the 20 imported + the Magic Drop draft", () => expect(products).toHaveLength(21));
  it("has unique ids and slugs", () => {
    expect(new Set(products.map((p) => p.id)).size).toBe(products.length);
    expect(new Set(products.map((p) => p.slug)).size).toBe(products.length);
  });
  it("keeps exactly one shampoo, hair mask, aloe vera gel, face serum, sunscreen and tomato face wash", () => {
    for (const word of ["shampoo", "sunscreen", "serum", "tomato"]) expect(products.filter((p) => p.name.toLowerCase().includes(word))).toHaveLength(1);
    expect(products.filter((p) => p.slug.startsWith("hair-mask"))).toHaveLength(1);
    expect(products.filter((p) => p.slug === "aloe-vera-gel")).toHaveLength(1);
  });
  it("every product-sheet group points at products that exist", () => {
    for (const e of productSheet) for (const s of e.matches) expect(products.some((p) => p.slug === s)).toBe(true);
  });
});

describe("verified updates keep ids and prices", () => {
  it("keeps the existing prices", () => {
    expect(price("tomato-face-wash")).toEqual([380, 390]);
    expect(price("sunscreen")).toEqual([470, 480]);
    expect(price("hair-mask")).toEqual([720, 750]);
    expect(price("face-serum")).toEqual([680, 699]);
    expect(price("aloe-vera-gel")).toEqual([360, 399]);
  });
  it("uses the net quantity printed on the pack", () => {
    expect(bySlug("sunscreen").variants[0]!.label).toBe("50 g");
    expect(bySlug("hair-mask").variants[0]!.label).toBe("200 g");
    expect(bySlug("face-serum").variants[0]!.label).toBe("30 ml");
    expect(bySlug("aloe-vera-gel").variants[0]!.label).toBe("200 g");
  });
  it("leaves uncertain sizes unconfirmed (shampoo) and adds no extra sizes", () => {
    expect(bySlug("shampoo").variants.map((v) => v.label)).toEqual(["Size to be confirmed"]);
    for (const s of ["hair-mask", "aloe-vera-gel"]) expect(bySlug(s).variants).toHaveLength(1);
  });
  it("names the sunscreen as printed on the pack, same id", () => {
    expect(bySlug("sunscreen").id).toBe("bya-1073");
    expect(bySlug("sunscreen").name).toMatch(/^Moisturizer & Sunscreen SPF 50\+ PA\+\+\+/);
  });
  it("never repeats a photo inside one gallery", () => {
    for (const p of products) expect(new Set(p.images).size).toBe(p.images?.length ?? 0);
  });
  it("keeps uncertain supplied photos out of every gallery", () => {
    for (const ph of pendingPhotos) expect(products.some((p) => p.images?.includes(ph.src))).toBe(false);
  });
});

describe("Magic Drop draft", () => {
  const md = bySlug("magic-drop");
  it("is hidden and not listed in the shop or search", () => {
    expect(md.status).toBe("draft");
    expect(filterProducts(products, {}).some((p) => p.slug === "magic-drop")).toBe(false);
    expect(filterProducts(products, { q: "magic" })).toHaveLength(0);
  });
  it("cannot be bought (no price)", () => expect(checkVariant(md, md.variants[0]!.id).ok).toBe(false));
});

describe("claims stay off the shop", () => {
  it("flags FDA approval and Dubai availability in the sheet", () => {
    const f = flaggedPoints();
    expect(f.some((x) => x.text.startsWith("FDA approved"))).toBe(true);
    expect(f.some((x) => x.text === "available in Dubai")).toBe(true);
  });
  it("adds no flagged wording to any public product field", () => {
    for (const p of products) {
      const info = productInfoSections(p);
      const text = [...info.keyIngredients, ...info.ingredients, info.directions ?? "", p.description].join(" ");
      expect(text).not.toMatch(/FDA|Dubai/i);
    }
  });
});

describe("saved demo data upgrade", () => {
  const old = (s: string): Product => { const p = structuredClone(bySlug(s)); return { ...p, name: s === "sunscreen" ? "Sunscreen SPF 50++ – Hydrating formula with no white cast for all-day protection" : p.name, keyIngredients: undefined, variants: p.variants.map((v) => ({ ...v, label: "Size to be confirmed" })), images: ["/old.webp"] }; };
  it("fills confirmed facts, refreshes photos and adds Magic Drop, without touching prices", () => {
    const stored = [{ ...old("sunscreen"), variants: old("sunscreen").variants.map((v) => ({ ...v, price: 455 })) }];
    const [s, ...rest] = reviseStored(stored, products);
    expect(s!.variants[0]!.label).toBe("50 g");
    expect(s!.variants[0]!.price).toBe(455);
    expect(s!.images).toEqual(bySlug("sunscreen").images);
    expect(rest.map((p) => p.id)).toEqual([magicDropDraft.id]);
  });
  it("keeps an admin's uploaded photos and own edits", () => {
    const edited = { ...old("face-serum"), images: ["data:image/webp;base64,AAA"], directions: "Admin wrote this", name: "My name" };
    const [s] = reviseStored([edited], products);
    expect(s!.images).toEqual(["data:image/webp;base64,AAA"]);
    expect(s!.directions).toBe("Admin wrote this");
    expect(s!.name).toBe("My name");
  });
  it("does not add Magic Drop twice", () => {
    const once = reviseStored([], products);
    expect(reviseStored(once, products).filter((p) => p.slug === "magic-drop")).toHaveLength(1);
  });
  it("applyPatch never replaces a confirmed size", () => {
    const p = { ...bySlug("hair-mask"), variants: [{ ...bySlug("hair-mask").variants[0]!, label: "250 g" }] };
    expect(applyPatch(p).variants[0]!.label).toBe("250 g");
  });
});
