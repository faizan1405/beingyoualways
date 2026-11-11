import { describe, expect, it } from "vitest";
import { productImages, withExtraImage, withMainImage } from "./product-images";
import { products } from "./mock-data";

describe("product photo mapping", () => {
  it("keeps all 20 imported products, each with at least one real photo", () => {
    expect(products).toHaveLength(20);
    for (const p of products) expect(productImages(p.slug).length).toBeGreaterThan(0);
  });
  it("replacing the main photo keeps the extra photos", () => {
    expect(withMainImage(["a", "b", "c"], "new")).toEqual(["new", "b", "c"]);
  });
  it("adding an extra photo appends it once", () => {
    expect(withExtraImage(["a"], "b")).toEqual(["a", "b"]);
    expect(withExtraImage(["a", "b"], "b")).toEqual(["a", "b"]);
  });
});
