import { describe, expect, it } from "vitest";

import imported from "@/lib/catalogue.json";
import { reviseStored } from "@/lib/catalogue-revision";
import { products } from "@/lib/mock-data";
import { GALLERY_VIEWS, galleryAlt, galleryImages, galleryView, originalImages } from "@/lib/product-images";
import type { Product } from "@/lib/types";

type Raw = { id: string; slug: string; variants: { id: string; price: number; compareAtPrice?: number }[]; category: string };
const raw = imported as unknown as Raw[];
const bySlug = (s: string) => products.find((p) => p.slug === s)!;

describe("four-image product gallery", () => {
  it("covers all 20 catalogue products", () => expect(raw.filter((r) => galleryImages(r.slug).length === 4)).toHaveLength(20));

  it("shows exactly four photos per product in the order hero, ingredients, texture, lifestyle", () => {
    for (const r of raw) {
      const imgs = bySlug(r.slug).images ?? [];
      expect(imgs).toHaveLength(4);
      expect(imgs.map(galleryView)).toEqual([...GALLERY_VIEWS]);
    }
  });

  it("keeps the original photos as a separate backup, not deleted", () => {
    for (const r of raw) {
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
    const stale: Product = { ...structuredClone(bySlug("kajal")), images: ["/old-kajal.webp"] };
    const uploaded: Product = { ...structuredClone(bySlug("toner")), images: ["data:image/webp;base64,AAA"] };
    const out = reviseStored([stale, uploaded], products);
    expect(out.find((p) => p.slug === "kajal")!.images).toEqual(galleryImages("kajal"));
    expect(out.find((p) => p.slug === "toner")!.images).toEqual(["data:image/webp;base64,AAA"]);
  });

  it("describes each gallery shot for screen readers", () => {
    const g = galleryImages("toner");
    expect(galleryAlt("Toner", g[1]!, 1, 4)).toBe("Toner — with its key ingredients");
    expect(galleryAlt("Toner", "/x/toner-3.webp", 2, 5)).toBe("Toner — photo 3 of 5");
  });
});
