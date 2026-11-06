// Central product photo registry. Files live in src/assets/products/<slug>-<n>.webp
// (1 = studio, 2 = lifestyle, 3 = texture). AI-generated concept photography —
// replace with the client's real packaging shots when supplied.
const files = import.meta.glob<string>("../assets/products/*.webp", { eager: true, import: "default" });

const bySlug: Record<string, string[]> = {};
for (const [path, url] of Object.entries(files)) {
  const m = path.match(/\/([a-z0-9-]+)-(\d)\.webp$/);
  if (!m) continue;
  const [, slug, n] = m;
  (bySlug[slug!] ??= [])[Number(n) - 1] = url;
}

export function productImages(slug: string): string[] {
  return (bySlug[slug] ?? []).filter(Boolean);
}
