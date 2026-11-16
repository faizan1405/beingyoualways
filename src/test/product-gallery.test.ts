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
const ready = raw.filter((r) => infographicFor(r.slug)?.status === "ready");
const shown = raw.filter((r) => ["ready", "preview"].includes(infographicFor(r.slug)?.status ?? ""));
const drafts = raw.filter((r) => infographicFor(r.slug)?.status === "draft");

describe("product infographic galleries", () => {
  it("has a four-slide infographic set for all 20 catalogue products", () => {
    expect(infographics).toHaveLength(20);
    for (const r of raw) expect(infographicImages(r.slug)).toHaveLength(4);
  });

  it("ready and preview products show exactly the four slides: product photo, who, inside, how", () => {
    expect(shown).toHaveLength(18);
    for (const r of shown) {
      const imgs = bySlug(r.slug).images ?? [];
      expect(imgs).toHaveLength(4);
      expect(imgs.map(galleryView)).toEqual([...INFOGRAPHIC_VIEWS]);
    }
  });

  it("the first image is always the clean product photo", () => {
    for (const r of raw) expect(galleryView(bySlug(r.slug).images![0]!)).toBe("hero");
  });

  it("draft sets never reach shoppers — those products keep the previous gallery", () => {
    for (const r of drafts) {
      const imgs = bySlug(r.slug).images ?? [];
      expect(imgs).toEqual(galleryImages(r.slug));
      expect(imgs.some((src) => ["who", "inside", "how"].includes(galleryView(src) ?? ""))).toBe(false);
    }
  });

  it("a set reaches shoppers only when it is ready or in preview", () => {
    expect(catalogueImages("face-serum", () => true)).toEqual(infographicImages("face-serum"));
    expect(catalogueImages("face-serum", () => false)).toEqual(galleryImages("face-serum"));
  });

  it("keeps the four client-verified sets ready with their own directions", () => {
    expect(ready.map((r) => r.slug).sort()).toEqual(["aloe-vera-gel", "eyebrow-definer", "liquid-eyeliner", "true-base-liquid-foundation"]);
    for (const r of ready) expect(infographicFor(r.slug)?.guide).toBe("verified");
    expect(infographicFor("aloe-vera-gel")?.steps.map((x) => x.text)).toEqual(["Dispense onto the palm of your hand.", "Apply liberally to the skin or hair."]);
  });

  it("general How to use guides are flagged as pending client approval, never approved", () => {
    const general = infographics.filter((x) => x.guide === "general");
    expect(general).toHaveLength(14);
    for (const g of general) {
      expect(g.status).toBe("preview");
      expect(g.missing.join(" ")).toMatch(/approval/i);
    }
  });

  it("general guides invent no amounts or timings (only the face mask uses the client sheet's times)", () => {
    for (const g of infographics.filter((x) => x.guide === "general" && x.slug !== "face-mask")) {
      for (const st of g.steps) expect(st.text).not.toMatch(/\d/);
    }
    expect(infographicFor("face-mask")?.steps.map((x) => x.text).join(" ")).toMatch(/10 min for women, 15–20 min for men/);
  });

  it("the face serum guide follows the brief: cleanse, small amount, spread, moisturiser", () => {
    expect(infographicFor("face-serum")?.steps.map((x) => x.title)).toEqual(["Cleanse", "Apply", "Spread", "Moisturise"]);
  });

  it("wax powder sets stay drafts while the preparation method is unknown", () => {
    for (const slug of ["herbal-wax-powder", "wax-powder-aloe-vera-gel-combo"]) {
      expect(infographicFor(slug)?.status).toBe("draft");
      expect(infographicFor(slug)?.missing.join(" ")).toMatch(/prepare/i);
    }
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
