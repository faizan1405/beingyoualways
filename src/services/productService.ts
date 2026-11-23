// Product repository. Today it reads in-memory sample data; later swap the
// bodies for fetch(`${API_BASE_URL}/products...`) without touching pages.
import { categories, products as seed } from "@/lib/mock-data";
import type { CategorySlug, Product } from "@/lib/types";
import { bestSellerSlugs, productConcerns, type ConcernSlug } from "@/lib/concerns";
import { BEST_SELLER_PICKS, CATALOGUE_REVISION, applyBestSellerPicks, reviseStored } from "@/lib/catalogue-revision";

// Demo admin edits persist in localStorage; resetDemo() restores the imported catalogue.
const KEY = "bya.products.v2";
// Saved demo edits from before the High Demand flag existed keep the catalogue's starting picks.
const withHighDemandDefaults = (list: Product[]): Product[] =>
  list.map((p) => (p.bestSeller === undefined ? { ...p, bestSeller: seed.find((s) => s.id === p.id)?.bestSeller ?? false } : p));
// Saved demo data from before a catalogue revision is upgraded once (admin edits kept).
const REV_KEY = "bya.products.rev";
// The client's Best Seller picks are applied to saved demo data once per picks version.
const PICKS_KEY = "bya.products.bestSellerPicks";
const load = (): Product[] => {
  if (typeof window === "undefined") return structuredClone(seed);
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!Array.isArray(v)) return structuredClone(seed);
    let list = withHighDemandDefaults(v);
    if (localStorage.getItem(REV_KEY) !== CATALOGUE_REVISION) {
      list = reviseStored(list, seed);
      try { localStorage.setItem(KEY, JSON.stringify(list)); localStorage.setItem(REV_KEY, CATALOGUE_REVISION); } catch { /* storage full: use upgraded copy for this visit */ }
    }
    if (localStorage.getItem(PICKS_KEY) !== BEST_SELLER_PICKS) {
      list = applyBestSellerPicks(list, bestSellerSlugs);
      try { localStorage.setItem(KEY, JSON.stringify(list)); localStorage.setItem(PICKS_KEY, BEST_SELLER_PICKS); } catch { /* storage full: use upgraded copy for this visit */ }
    }
    return list;
  } catch { return structuredClone(seed); }
};
let store: Product[] = load();
const persist = () => { if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(store)); };

// Live updates: pages showing admin-controlled lists (e.g. homepage High Demand) re-read on change,
// including edits made in another tab of this browser.
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === KEY) { store = load(); notify(); } });
}
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

/** Homepage Best Seller: only active products marked Best Seller — client's picks in their order, then other marked ones. Never filler. */
export const selectHighDemand = (list: Product[]): Product[] => {
  const rank = (p: Product) => { const i = bestSellerSlugs.indexOf(p.slug); return i < 0 ? bestSellerSlugs.length : i; };
  return list.filter((p) => p.status === "active" && p.bestSeller === true).map((p, i) => ({ p, i })).sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i).map(({ p }) => p);
};

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

/** Related products: admin picks (in their order) first, else same category. Active only. */
export function relatedFor(list: Product[], p: Product, limit = 4): Product[] {
  if (p.relatedSlugs?.length) return p.relatedSlugs.flatMap((s) => list.filter((x) => x.slug === s && x.id !== p.id && x.status === "active")).slice(0, limit);
  return list.filter((x) => x.category === p.category && x.id !== p.id && x.status === "active").slice(0, limit);
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** A hidden draft copy with new ids — never shown in the shop until published. */
export function duplicateOf(p: Product, existing: Product[], stamp = Date.now()): Product {
  let slug = `${p.slug}-copy`;
  for (let n = 2; existing.some((x) => x.slug === slug); n++) slug = `${p.slug}-copy-${n}`;
  return {
    ...structuredClone(p), id: `p${stamp}`, slug, name: `${p.name} (copy)`, status: "draft", bestSeller: false, featured: false, isSample: true,
    variants: p.variants.map((v, i) => ({ ...v, id: `v${stamp}-${i}` })),
  };
}

const looksLikeProduct = (x: unknown): x is Product => {
  const p = x as Product;
  return !!p && typeof p.id === "string" && typeof p.slug === "string" && typeof p.name === "string" && Array.isArray(p.variants) && p.variants.length > 0;
};

export function validateProduct(p: Product, all: Product[]): string[] {
  const e: string[] = [];
  if (p.name.trim().length < 2) e.push("Product name is required.");
  const slug = p.slug || slugify(p.name);
  if (!slug) e.push("Product web address can't be empty.");
  if (all.some((x) => x.id !== p.id && x.slug === slug)) e.push("Another product already uses this web address — change the name or address.");
  if (p.variants.length === 0) e.push("Add at least one size or shade.");
  if (p.variants.some((v) => !v.label.trim())) e.push("Each size or shade needs a label.");
  if (p.variants.some((v) => !(v.price >= 0))) e.push("Prices can't be negative.");
  // Unpriced products may be saved as hidden drafts, but never shown in the shop.
  if (p.status === "active" && p.variants.some((v) => !(v.price > 0))) e.push("A product visible in the shop needs a selling price for every size or shade — or keep it hidden.");
  if (p.variants.some((v) => v.compareAtPrice != null && v.compareAtPrice <= v.price)) e.push("MRP must be higher than the selling price — or leave it blank.");
  if (p.variants.some((v) => !(v.stock >= 0) || !Number.isFinite(v.stock))) e.push("Stock can't be negative.");
  return e;
}

export const productService = {
  list: (query: ProductQuery = {}) => delay(filterProducts(store, query)),
  featured: () => delay(store.filter((p) => p.featured && p.status === "active")),
  /** Products marked "High Demand" in admin (later: GET /products?high_demand=1). */
  highDemand: () => delay(selectHighDemand(store)),
  /** Mark / unmark High Demand without touching any other field. */
  setHighDemand: (id: string, on: boolean) => {
    const p = store.find((x) => x.id === id);
    if (!p) return Promise.reject(new Error("Product not found"));
    return productService.save({ ...p, bestSeller: on });
  },
  /** Re-run fn whenever demo product data changes. Returns an unsubscribe function. */
  subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  /** Storefront lookup: hidden drafts/archived products are not reachable by URL. */
  getBySlug: (slug: string) => delay(store.find((p) => p.slug === slug && p.status === "active") ?? null),
  getById: (id: string) => delay(store.find((p) => p.id === id) ?? null),
  /** Hand-picked related products when set in admin, otherwise more from the same category. */
  related: (p: Product) => delay(relatedFor(store, p)),
  /** Products sharing at least one verified concern tag, most shared first. */
  alsoLike: (p: Product, exclude: string[] = []) => delay(recommendByConcern(store, p, exclude)),
  categories: () => delay(categories),
  byConcern: (c: ConcernSlug) => delay(store.filter((p) => p.status === "active" && concernsOf(p).includes(c))),
  bySlugs: (slugs: string[]) => delay(store.filter((p) => p.status === "active" && slugs.includes(p.slug))),
  getCategory: (slug: string) => delay(categories.find((c) => c.slug === slug) ?? null),
  // Admin (demo — saved in this browser only)
  save: (input: Product) => {
    const product = { ...input, slug: input.slug || slugify(input.name) };
    const errors = validateProduct(product, store);
    if (errors.length) return Promise.reject(new Error(errors.join(" ")));
    const before = store;
    const i = store.findIndex((p) => p.id === product.id);
    store = i >= 0 ? store.map((p) => (p.id === product.id ? product : p)) : [product, ...store];
    try { persist(); } catch {
      // Usually the browser's demo storage is full (large uploaded photos). Nothing is half-saved.
      store = before;
      return Promise.reject(new Error("This browser's demo storage is full. Remove an uploaded photo or use Reset demo data, then try again."));
    }
    notify();
    return delay(product);
  },
  duplicate: (id: string) => {
    const p = store.find((x) => x.id === id);
    if (!p) return Promise.reject(new Error("Product not found"));
    return productService.save(duplicateOf(p, store));
  },
  /** Replace the whole demo catalogue from a backup file (shape-checked). */
  importAll: (list: unknown[]) => {
    if (!list.length || !list.every(looksLikeProduct)) return Promise.reject(new Error("The backup's product list is not valid."));
    const before = store;
    store = structuredClone(list as Product[]);
    try { persist(); if (typeof window !== "undefined") localStorage.setItem(REV_KEY, CATALOGUE_REVISION); } catch { store = before; return Promise.reject(new Error("Not enough browser storage for this backup.")); }
    notify();
    return delay(true);
  },
  remove: (id: string) => {
    store = store.filter((p) => p.id !== id);
    persist();
    notify();
    return delay(true);
  },
  /** Restore the imported catalogue and discard demo edits. */
  resetDemo: () => {
    store = structuredClone(seed);
    if (typeof window !== "undefined") { localStorage.removeItem(KEY); localStorage.setItem(REV_KEY, CATALOGUE_REVISION); }
    notify();
    return delay(true);
  },
  /** Synchronous lookup used by the cart to render line items. */
  peekAll: () => store,
  /** Imported catalogue (server render / first hydration pass). */
  seedAll: () => seed,
};
