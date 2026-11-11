// Central product photo registry. Files live in src/assets/products/<slug>-<n>.webp
// Real product photos from beingyoualways.com, resized to WebP (max 900px) for mobile.
const files = import.meta.glob<string>("../assets/products/*.webp", { eager: true, import: "default" });

const bySlug: Record<string, string[]> = {};
for (const [path, url] of Object.entries(files)) {
  const m = path.match(/\/([a-z0-9-]+)-(\d+)\.webp$/);
  if (!m) continue;
  const [, slug, n] = m;
  (bySlug[slug!] ??= [])[Number(n) - 1] = url;
}

export function productImages(slug: string): string[] {
  return (bySlug[slug] ?? []).filter(Boolean);
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
