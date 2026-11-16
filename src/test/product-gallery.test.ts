import { describe, expect, it } from "vitest";

import imported from "@/lib/catalogue.json";
import { infographicFor, infographics } from "@/content/infographics";
import { reviseStored } from "@/lib/catalogue-revision";
import { products } from "@/lib/mock-data";
import { GALLERY_VIEWS, INFOGRAPHIC_VIEWS, catalogueImages, galleryAlt, galleryImages, galleryView, infographicImages, originalImages } from "@/lib/product-images";
import type { Product } from "@/lib/types";

type Raw = { id: string; slug: string; variants: { id: string; price: number; compareAtPrice?: number }[]; category: string };
const raw = imported as unknown as Raw[];
const bySlug = (s: string) => products.find((p) => p.slug === s)!;
const shown = raw.filter((r) => infographicFor(r.slug)?.status === "ready");
const drafts = raw.filter((r) => infographicFor(r.slug)?.status === "draft");

describe("product infographic galleries", () => {
  it("has a four-slide infographic set for all 20 catalogue products plus the new body lotion", () => {
    expect(infographics).toHaveLength(21);
    for (const r of raw) expect(infographicImages(r.slug)).toHaveLength(4);
    expect(infographicImages("all-season-body-lotion")).toHaveLength(4);
  });

  it("every catalogue product shows exactly the four slides: product photo, who, inside, how", () => {
    expect(shown).toHaveLength(20);
    expect(drafts).toHaveLength(0);
    for (const r of shown) {
      const imgs = bySlug(r.slug).images ?? [];
      expect(imgs).toHaveLength(4);
      expect(imgs.map(galleryView)).toEqual([...INFOGRAPHIC_VIEWS]);
    }
  });

  it("the first image is always the clean product photo", () => {
    for (const r of raw) expect(galleryView(bySlug(r.slug).images![0]!)).toBe("hero");
  });

  it("a set reaches shoppers only when it is ready", () => {
    expect(catalogueImages("face-serum", () => true)).toEqual(infographicImages("face-serum"));
    expect(catalogueImages("face-serum", () => false)).toEqual(galleryImages("face-serum"));
  });

  it("products photographed in Nov 2026 use the pack's own directions", () => {
    expect(infographicFor("face-wash")?.guide).toBe("verified");
    expect(infographicFor("shampoo")?.guide).toBe("verified");
    expect(infographicFor("sunscreen")?.steps.map((x) => x.text).join(" ")).toMatch(/15 minutes before.*Every 4 hours/);
  });

  it("wax powder follows the brief: apply against hair growth, wait 15 minutes, wipe, rinse", () => {
    const t = infographicFor("herbal-wax-powder")!.steps.map((x) => x.text).join(" ");
    expect(t).toMatch(/against the direction of hair growth/);
    expect(t).toMatch(/15 minutes/);
    expect(t).toMatch(/wet cloth, then rinse/);
  });

  it("the face serum guide uses 2–3 drops, as the brief allows", () => {
    expect(infographicFor("face-serum")?.steps.map((x) => x.text).join(" ")).toMatch(/2–3 drops/);
  });

  it("common category guides are labelled on the slide data, never passed off as pack directions", () => {
    const general = infographics.filter((x) => x.guide === "general");
    expect(general.length).toBeGreaterThan(0);
    for (const g of general) expect(g.sources.how).toMatch(/common category guide/i);
  });

  it("the body lotion is a hidden draft with no price or stock", () => {
    const p = bySlug("all-season-body-lotion");
    expect(p.status).toBe("draft");
    expect(p.variants.every((v) => v.price === 0 && v.stock === 0)).toBe(true);
    expect(p.images?.map(galleryView)).toEqual([...INFOGRAPHIC_VIEWS]);
  });

  it("pack sizes from the new photos replace 'to be confirmed'", () => {
    expect(bySlug("face-wash").variants[0]!.label).toBe("100 ml");
    expect(bySlug("shampoo").variants[0]!.label).toBe("200 ml");
    expect(bySlug("hair-oil").variants[0]!.label).toBe("110 ml");
  });

  it("a newer pack photo replaces earlier patched key ingredients, but keeps admin edits", () => {
    const old: Product = { ...structuredClone(bySlug("shampoo")), keyIngredients: ["Canadian Maple Tree Extract"] };
    const edited: Product = { ...structuredClone(bySlug("face-wash")), keyIngredients: ["Admin choice"] };
    const out = reviseStored([old, edited], products);
    expect(out.find((p) => p.slug === "shampoo")!.keyIngredients).toEqual(bySlug("shampoo").keyIngredients);
    expect(out.find((p) => p.slug === "face-wash")!.keyIngredients).toEqual(["Admin choice"]);
    expect(out.some((p) => p.slug === "all-season-body-lotion")).toBe(true);
  });

  it("keeps the previous four photos and the originals as backup, not deleted", () => {
    for (const r of raw) {
      expect(galleryImages(r.slug).map(galleryView)).toEqual([...GALLERY_VIEWS]);
      const orig = originalImages(r.slug);
      expect(orig.length).toBeGreaterThan(0);
      for (const src of orig) expect(galleryImages(r.slug)).not.toContain(src);
    }
  });

  it("does not change product ids, categories, variant ids or prices", () => {
    for (const r of raw) {
      const p = bySlug(r.slug);
      expect(p.id).toBe(r.id);
      expect(p.category).toBe(r.category);
      expect(p.variants.map((v) => [v.id, v.price, v.compareAtPrice ?? null])).toEqual(r.variants.map((v) => [v.id, v.price, v.compareAtPrice ?? null]));
    }
  });

  it("upgrades galleries saved before this revision, but keeps admin uploads", () => {
    const stale: Product = { ...structuredClone(bySlug("aloe-vera-gel")), images: ["/old-aloe.webp"] };
    const uploaded: Product = { ...structuredClone(bySlug("toner")), images: ["data:image/webp;base64,AAA"] };
    const out = reviseStored([stale, uploaded], products);
    expect(out.find((p) => p.slug === "aloe-vera-gel")!.images).toEqual(bySlug("aloe-vera-gel").images);
    expect(out.find((p) => p.slug === "toner")!.images).toEqual(["data:image/webp;base64,AAA"]);
  });

  it("describes each slide for screen readers", () => {
    const s = infographicImages("aloe-vera-gel");
    expect(galleryAlt("Aloe Vera Gel", s[3]!, 3, 4)).toBe("Aloe Vera Gel — how to use");
    expect(galleryAlt("Toner", galleryImages("toner")[1]!, 1, 4)).toBe("Toner — with its key ingredients");
    expect(galleryAlt("Toner", "/x/toner-3.webp", 2, 5)).toBe("Toner — photo 3 of 5");
  });
});
