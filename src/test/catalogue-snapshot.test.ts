// The production database is seeded from server/prisma/seed/catalogue.json. This test
// proves that file is an exact copy of the storefront's verified catalogue (all products,
// prices, shades, categories and photos). Regenerate after a catalogue revision with:
//   UPDATE_CATALOGUE_SNAPSHOT=1 bunx vitest run src/test/catalogue-snapshot.test.ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { categories, products } from "@/lib/mock-data";
import { resolveImageRef, toImageRef } from "@/lib/image-refs";

const FILE = path.resolve(__dirname, "../../server/prisma/seed/catalogue.json");

const snapshot = () => ({
  categories,
  products: products.map((p) => ({ ...p, images: (p.images ?? []).map(toImageRef) })),
});

describe("database seed catalogue", () => {
  if (process.env["UPDATE_CATALOGUE_SNAPSHOT"] === "1") {
    it("writes the snapshot", () => { writeFileSync(FILE, JSON.stringify(snapshot(), null, 2) + "\n"); });
    return;
  }

  it("matches the storefront catalogue exactly", () => {
    expect(existsSync(FILE)).toBe(true);
    const saved = JSON.parse(readFileSync(FILE, "utf8"));
    expect(saved).toEqual(JSON.parse(JSON.stringify(snapshot())));
  });

  it("keeps all 20 configured products with unique ids and web addresses", () => {
    const saved = JSON.parse(readFileSync(FILE, "utf8")) as { products: { id: string; slug: string }[] };
    expect(saved.products.length).toBe(products.length);
    expect(products.filter((p) => p.status === "active").length).toBe(20);
    expect(new Set(saved.products.map((p) => p.id)).size).toBe(saved.products.length);
    expect(new Set(saved.products.map((p) => p.slug)).size).toBe(saved.products.length);
  });

  it("stores every bundled photo as a reference that resolves back to the same file", () => {
    for (const p of products) for (const url of p.images ?? []) {
      const ref = toImageRef(url);
      expect(ref.startsWith("asset:") || ref.startsWith("https://")).toBe(true);
      expect(resolveImageRef(ref)).toBe(url);
    }
  });
});
