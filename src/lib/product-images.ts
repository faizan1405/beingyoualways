// Central product photo registry.
// - Original photos (backup, never deleted): src/assets/products/<slug>-<n>.webp — real
//   photos from beingyoualways.com, resized to WebP (max 900px).
// - Four-image gallery: src/assets/products/gallery/<slug>/01-hero … 04-lifestyle.webp
//   (1600×1600). The genuine packaging is composited as a locked cut-out — labels are
//   never regenerated. Texture shots show no packaging.
const files = import.meta.glob<string>("../assets/products/*.webp", { eager: true, import: "default" });
const galleryFiles = import.meta.glob<string>("../assets/products/gallery/*/*.webp", { eager: true, import: "default" });

export const GALLERY_VIEWS = ["hero", "ingredients", "texture", "lifestyle"] as const;
export type GalleryView = (typeof GALLERY_VIEWS)[number];
const VIEW_LABEL: Record<GalleryView, string> = {
  hero: "product photo",
  ingredients: "with its key ingredients",
  texture: "texture and application",
  lifestyle: "in a daily routine",
};

const bySlug: Record<string, string[]> = {};
for (const [path, url] of Object.entries(files)) {
  const m = path.match(/\/([a-z0-9-]+)-(\d+)\.webp$/);
  if (!m) continue;
  const [, slug, n] = m;
  (bySlug[slug!] ??= [])[Number(n) - 1] = url;
}

const gallery: Record<string, string[]> = {};
for (const [path, url] of Object.entries(galleryFiles)) {
  const m = path.match(/\/gallery\/([a-z0-9-]+)\/0([1-4])-([a-z]+)\.webp$/);
  if (!m || m[3] !== GALLERY_VIEWS[Number(m[2]) - 1]) continue;
  (gallery[m[1]!] ??= [])[Number(m[2]) - 1] = url;
}

/** Original photos for a product (the backup set; also used for decorative site imagery). */
export function productImages(slug: string): string[] {
  return (bySlug[slug] ?? []).filter(Boolean);
}
/** Alias that reads clearly in the admin "restore originals" panel. */
export const originalImages = productImages;

/** The complete four-image gallery (hero, ingredients, texture, lifestyle) or [] if incomplete. */
export function galleryImages(slug: string): string[] {
  const g = gallery[slug] ?? [];
  return GALLERY_VIEWS.every((_, i) => g[i]) ? g.slice(0, 4) : [];
}

/** Photos a catalogue product starts with: the four-image gallery when complete, else the originals. */
export function catalogueImages(slug: string): string[] {
  const g = galleryImages(slug);
  return g.length ? g : productImages(slug);
}

/** Which gallery shot a URL is (works on built, hashed file names), or null for other photos. */
export function galleryView(src: string): GalleryView | null {
  const m = src.match(/0([1-4])-(hero|ingredients|texture|lifestyle)[.-]/);
  return m && GALLERY_VIEWS[Number(m[1]) - 1] === m[2] ? (m[2] as GalleryView) : null;
}
export function galleryAlt(name: string, src: string, i: number, n: number): string {
  const v = galleryView(src);
  return v ? `${name} — ${VIEW_LABEL[v]}` : `${name} — photo ${i + 1} of ${n}`;
}

// Photo-list edits used by the admin editor. They only touch the image list, so a
// product's id, slug, prices and sizes stay exactly as they were.
/** Put `src` first as the main photo; the previous main photo is dropped. */
export function withMainImage(images: string[] | undefined, src: string): string[] {
  const rest = (images ?? []).slice(1).filter((x) => x !== src);
  return [src, ...rest];
}
/** Add `src` after the existing photos (no duplicates). */
export function withExtraImage(images: string[] | undefined, src: string): string[] {
  const list = images ?? [];
  return list.includes(src) ? list : [...list, src];
}
