// Central product photo registry.
// - Original photos (backup, never deleted): src/assets/products/<slug>-<n>.webp — real
//   photos from beingyoualways.com, resized to WebP (max 900px).
// - Four-image gallery: src/assets/products/gallery/<slug>/01-hero … 04-lifestyle.webp
//   (1600×1600). The genuine packaging is composited as a locked cut-out — labels are
//   never regenerated. Texture shots show no packaging. Kept as backup.
// - Infographic set: 01-hero (above) + src/assets/products/infographics/<slug>/02-who,
//   03-inside, 04-how .webp, rendered from design/gallery-slides. Shoppers see it only when
//   the set is "ready" in src/content/infographics.json.
import { isInfographicReady } from "@/content/infographics";

const files = import.meta.glob<string>("../assets/products/*.webp", { eager: true, import: "default" });
const galleryFiles = import.meta.glob<string>("../assets/products/gallery/*/*.webp", { eager: true, import: "default" });
const infoFiles = import.meta.glob<string>("../assets/products/infographics/*/*.webp", { eager: true, import: "default" });

export const GALLERY_VIEWS = ["hero", "ingredients", "texture", "lifestyle"] as const;
/** The approved infographic order: product photo, then the three information slides. */
export const INFOGRAPHIC_VIEWS = ["hero", "who", "inside", "how"] as const;
export type GalleryView = (typeof GALLERY_VIEWS)[number] | (typeof INFOGRAPHIC_VIEWS)[number];
const VIEW_LABEL: Record<GalleryView, string> = {
  hero: "product photo",
  ingredients: "with its key ingredients",
  texture: "texture and application",
  lifestyle: "in a daily routine",
  who: "who is it for",
  inside: "what's inside",
  how: "how to use",
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

const info: Record<string, string[]> = {};
for (const [path, url] of Object.entries(infoFiles)) {
  const m = path.match(/\/infographics\/([a-z0-9-]+)\/0([2-4])-([a-z]+)\.webp$/);
  if (!m || m[3] !== INFOGRAPHIC_VIEWS[Number(m[2]) - 1]) continue;
  (info[m[1]!] ??= [])[Number(m[2]) - 1] = url;
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

/** The four infographic slides (product photo, who, inside, how) or [] if any is missing. Drafts included. */
export function infographicImages(slug: string): string[] {
  const hero = (gallery[slug] ?? [])[0];
  const s = info[slug] ?? [];
  return hero && s[1] && s[2] && s[3] ? [hero, s[1], s[2], s[3]] : [];
}

/**
 * Photos a catalogue product starts with: the approved infographic set when its information is
 * fully verified; otherwise the previous four-image gallery, else the originals.
 */
export function catalogueImages(slug: string, ready: (slug: string) => boolean = isInfographicReady): string[] {
  const i = infographicImages(slug);
  if (i.length === 4 && ready(slug)) return i;
  const g = galleryImages(slug);
  return g.length ? g : productImages(slug);
}

/** Which gallery shot a URL is (works on built, hashed file names), or null for other photos. */
export function galleryView(src: string): GalleryView | null {
  const m = src.match(/0([1-4])-(hero|ingredients|texture|lifestyle|who|inside|how)[.-]/);
  if (!m) return null;
  const i = Number(m[1]) - 1;
  return GALLERY_VIEWS[i] === m[2] || INFOGRAPHIC_VIEWS[i] === m[2] ? (m[2] as GalleryView) : null;
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
