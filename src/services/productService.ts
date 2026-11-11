// Product repository. Today it reads in-memory sample data; later swap the
// bodies for fetch(`${API_BASE_URL}/products...`) without touching pages.
import { categories, products as seed } from "@/lib/mock-data";
import type { CategorySlug, Product } from "@/lib/types";
import { productConcerns, type ConcernSlug } from "@/lib/concerns";

// Demo admin edits persist in localStorage; resetDemo() restores the imported catalogue.
const KEY = "bya.products.v2";
const load = (): Product[] => {
  if (typeof window === "undefined") return structuredClone(seed);
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "null"); return Array.isArray(v) ? v : structuredClone(seed); } catch { return structuredClone(seed); }
};
let store: Product[] = load();
const persist = () => { if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(store)); };
const delay = <T,>(v: T) => Promise.resolve(structuredClone(v));

export type SortKey = "featured" | "price-asc" | "price-desc" | "name";
export interface ProductQuery {
  category?: CategorySlug | undefined;
  q?: string | undefined;
  maxPrice?: number | undefined;
  sort?: SortKey | undefined;
  includeInactive?: boolean | undefined;
}

export const minPrice = (p: Product) => Math.min(...p.variants.map((v) => v.price));
export const totalStock = (p: Product) => p.variants.reduce((s, v) => s + v.stock, 0);

export function filterProducts(list: Product[], query: ProductQuery): Product[] {
  let out = list.filter((p) => query.includeInactive || p.status === "active");
  if (query.category) out = out.filter((p) => p.category === query.category);
  if (query.q) {
    const q = query.q.toLowerCase();
    out = out.filter((p) => `${p.name} ${p.shortDescription} ${p.category}`.toLowerCase().includes(q));
  }
  if (query.maxPrice != null) out = out.filter((p) => minPrice(p) <= query.maxPrice!);
  switch (query.sort) {
    case "price-asc": out = [...out].sort((a, b) => minPrice(a) - minPrice(b)); break;
    case "price-desc": out = [...out].sort((a, b) => minPrice(b) - minPrice(a)); break;
    case "name": out = [...out].sort((a, b) => a.name.localeCompare(b.name)); break;
    default: out = [...out].sort((a, b) => Number(b.featured) - Number(a.featured));
  }
  return out;
}

export const concernsOf = (p: Product): string[] => p.concerns ?? productConcerns[p.slug] ?? [];

/** Recommendations based only on shared concern tags — never filler. */
export function recommendByConcern(list: Product[], p: Product, exclude: string[] = [], limit = 4): Product[] {
  const mine = new Set(concernsOf(p));
  if (mine.size === 0) return [];
  return list
    .filter((x) => x.id !== p.id && x.status === "active" && !exclude.includes(x.id))
    .map((x) => ({ x, shared: concernsOf(x).filter((c) => mine.has(c)).length }))
    .filter((r) => r.shared > 0)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, limit)
    .map((r) => r.x);
}

export const productService = {
  list: (query: ProductQuery = {}) => delay(filterProducts(store, query)),
  featured: () => delay(store.filter((p) => p.featured && p.status === "active")),
  getBySlug: (slug: string) => delay(store.find((p) => p.slug === slug) ?? null),
  getById: (id: string) => delay(store.find((p) => p.id === id) ?? null),
  /** More from the same category. */
  related: (p: Product) => delay(store.filter((x) => x.category === p.category && x.id !== p.id && x.status === "active").slice(0, 4)),
  /** Products sharing at least one verified concern tag, most shared first. */
  alsoLike: (p: Product, exclude: string[] = []) => delay(recommendByConcern(store, p, exclude)),
  categories: () => delay(categories),
  byConcern: (c: ConcernSlug) => delay(store.filter((p) => p.status === "active" && concernsOf(p).includes(c))),
  bySlugs: (slugs: string[]) => delay(store.filter((p) => p.status === "active" && slugs.includes(p.slug))),
  getCategory: (slug: string) => delay(categories.find((c) => c.slug === slug) ?? null),
  // Admin (demo — saved in this browser only)
  save: (product: Product) => {
    const before = store;
    const i = store.findIndex((p) => p.id === product.id);
    store = i >= 0 ? store.map((p) => (p.id === product.id ? product : p)) : [product, ...store];
    try { persist(); } catch {
      // Usually the browser's demo storage is full (large uploaded photos). Nothing is half-saved.
      store = before;
      return Promise.reject(new Error("This browser's demo storage is full. Remove an uploaded photo or use Reset demo data, then try again."));
    }
    return delay(product);
  },
  remove: (id: string) => {
    store = store.filter((p) => p.id !== id);
    persist();
    return delay(true);
  },
  /** Restore the imported catalogue and discard demo edits. */
  resetDemo: () => {
    store = structuredClone(seed);
    if (typeof window !== "undefined") localStorage.removeItem(KEY);
    return delay(true);
  },
  /** Synchronous lookup used by the cart to render line items. */
  peekAll: () => store,
};
