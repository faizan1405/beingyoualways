import { describe, expect, it } from "vitest";

import { products } from "@/lib/mock-data";
import { productService, selectHighDemand } from "@/services/productService";

describe("homepage High Demand", () => {
  it("shows only products marked High Demand, not every product", () => {
    const shown = selectHighDemand(products);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(products.length);
    expect(shown.every((p) => p.bestSeller === true)).toBe(true);
  });

  it("starts from the client's featured picks on the original site", () => {
    expect(selectHighDemand(products).map((p) => p.slug)).toEqual(products.filter((p) => p.featured).map((p) => p.slug));
  });

  it("skips products hidden from the shop even when marked", () => {
    const list = products.map((p) => (p.slug === "kajal" ? { ...p, bestSeller: true, status: "draft" as const } : p));
    expect(selectHighDemand(list).some((p) => p.slug === "kajal")).toBe(false);
  });

  it("is empty when nothing is marked (page shows the preview empty state)", () => {
    expect(selectHighDemand(products.map((p) => ({ ...p, bestSeller: false })))).toEqual([]);
  });

  it("admin mark/unmark updates the list and notifies the homepage, without changing other fields", async () => {
    await productService.resetDemo();
    const target = products.find((p) => !p.bestSeller)!;
    let calls = 0;
    const off = productService.subscribe(() => { calls++; });

    await productService.setHighDemand(target.id, true);
    expect((await productService.highDemand()).map((p) => p.id)).toContain(target.id);
    await productService.setHighDemand(target.id, false);
    expect((await productService.highDemand()).map((p) => p.id)).not.toContain(target.id);
    expect(calls).toBe(2);

    const after = await productService.getById(target.id);
    expect(after?.variants).toEqual(target.variants);
    expect(after?.name).toBe(target.name);
    off();
    await productService.resetDemo();
  });
});
