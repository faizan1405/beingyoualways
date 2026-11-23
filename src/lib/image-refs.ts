// Stable references for bundled catalogue photos, so the database can store a photo
// without knowing the build's hashed file name.
//   "asset:products/gallery/face-serum/01-hero.webp"  ⇄  "/assets/01-hero-3f9a.webp"
// Uploaded photos (Hostinger media) are plain https URLs and pass through unchanged.

const files = import.meta.glob<string>("../assets/products/**/*.webp", { eager: true, import: "default" });

const PREFIX = "asset:";
const toRefPath = (globPath: string) => globPath.replace(/^\.\.\/assets\//, "");

const urlByRef = new Map<string, string>();
const refByUrl = new Map<string, string>();
for (const [path, url] of Object.entries(files)) {
  const ref = PREFIX + toRefPath(path);
  urlByRef.set(ref, url);
  refByUrl.set(url, ref);
}

/** Bundled photo URL → "asset:…" reference; other URLs are returned unchanged. */
export const toImageRef = (url: string): string => refByUrl.get(url) ?? url;

/** "asset:…" reference → bundled URL. Unknown references resolve to null (photo removed from the build). */
export const resolveImageRef = (ref: string): string | null => (ref.startsWith(PREFIX) ? (urlByRef.get(ref) ?? null) : ref);

/** Resolve a stored image list, dropping references whose file no longer exists. */
export const resolveImageRefs = (refs: string[] | undefined): string[] =>
  (refs ?? []).flatMap((r) => { const u = resolveImageRef(r); return u ? [u] : []; });
