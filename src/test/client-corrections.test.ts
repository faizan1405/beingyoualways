import { describe, expect, it } from "vitest";

import { productsForGroup } from "@/components/home/CategoryShop";
import { globalStandardsContent, navigationConfig, brandConfig } from "@/config/business";
import { applyBestSellerPicks } from "@/lib/catalogue-revision";
import { bestSellerSlugs, homeCategoryGroups } from "@/lib/concerns";
import { products } from "@/lib/mock-data";

const group = (key: string) => homeCategoryGroups.find((g) => g.key === key)!;

describe("client website corrections (Nov 2026)", () => {
  it("header category row is Skin | Hair | De-Tan Care | Cosmetic | Combos | About Us, with no Shop item", () => {
    expect(navigationConfig.header.map((n) => n.label)).toEqual(["Skin", "Hair", "De-Tan Care", "Cosmetic", "Combos", "About Us"]);
    expect(navigationConfig.header.some((n) => /shop/i.test(n.label) || (n.to as string) === "/shop")).toBe(false);
  });

  it("header tagline is the client's wording", () => {
    expect(brandConfig.headerTagline).toBe("Nature-Powered Skin & Hair Care");
  });

  it("every homepage category slug is a real catalogue product (nothing invented)", () => {
    const slugs = new Set(products.map((p) => p.slug));
    for (const g of homeCategoryGroups) for (const s of g.slugs) expect(slugs.has(s)).toBe(true);
  });

  it("Tomato Face Wash shows in Skin Care and De-Tan Care as the same product record", () => {
    const skin = productsForGroup(products, group("skin").slugs).find((p) => p.slug === "tomato-face-wash");
    const detan = productsForGroup(products, group("de-tan").slugs).find((p) => p.slug === "tomato-face-wash");
    expect(skin?.id).toBe("bya-1027");
    expect(detan?.id).toBe(skin?.id);
    expect(products.filter((p) => p.slug === "tomato-face-wash")).toHaveLength(1);
  });

  it("groups follow the client's lists: 6 skin, 3 hair, 3 de-tan", () => {
    expect(productsForGroup(products, group("skin").slugs).map((p) => p.slug)).toEqual(["face-wash", "tomato-face-wash", "toner", "aloe-vera-gel", "sunscreen", "face-serum"]);
    expect(productsForGroup(products, group("hair").slugs).map((p) => p.slug)).toEqual(["hair-oil", "shampoo", "hair-mask"]);
    expect(productsForGroup(products, group("de-tan").slugs).map((p) => p.slug)).toEqual(["tomato-face-wash", "face-mask", "volcanic-scrub"]);
  });

  it("Magic Drop stays hidden from Cosmetics while it is a draft without a price", () => {
    const shown = productsForGroup(products, group("cosmetics").slugs).map((p) => p.slug);
    expect(group("cosmetics").slugs).toContain("magic-drop");
    expect(shown).not.toContain("magic-drop");
    expect(shown).toHaveLength(7);
  });

  it("Best Seller picks apply to saved data: only the four chosen products are marked", () => {
    const saved = products.map((p) => ({ ...p, bestSeller: p.slug === "kajal" }));
    const marked = applyBestSellerPicks(saved, bestSellerSlugs).filter((p) => p.bestSeller).map((p) => p.slug).sort();
    expect(marked).toEqual(["face-serum", "hair-mask", "hair-oil", "liquid-matte-lipstick"]);
  });

  it("countries are India, Korea, Spain, Brazil, Germany, United States, under a neutral heading", () => {
    expect(globalStandardsContent.countries.map((c) => c.name)).toEqual(["India", "Korea", "Spain", "Brazil", "Germany", "United States"]);
    expect(globalStandardsContent.displayHeading).not.toMatch(/import|sourc|origin/i);
  });
});
