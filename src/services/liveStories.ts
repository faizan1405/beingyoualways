// Public customer stories from the Hostinger server. The server only ever returns stories that
// are published, consented and from a verified purchase — the same rule the demo store follows.
import { API_ENDPOINTS, HOSTINGER_API_BASE_URL, isBackendConfigured } from "./api";
import type { AdminReview } from "./adminContentService";
import { testimonialCategories, type Testimonial } from "./testimonialService";

/** Media URLs come back as server paths ("/api/media/…"); make them absolute for the browser. */
export const absoluteMediaUrl = (url: string): string =>
  url.startsWith("/") && HOSTINGER_API_BASE_URL ? `${HOSTINGER_API_BASE_URL}${url}` : url;

/** Maps a server story to the shape the storefront sections already render. */
export function reviewToTestimonial(r: AdminReview): Testimonial {
  const media = r.media ?? [];
  const photo = media.find((m) => m.type === "photo" && !m.role);
  const before = media.find((m) => m.type === "photo" && m.role === "before");
  const after = media.find((m) => m.type === "photo" && m.role === "after");
  const video = media.find((m) => m.type === "video");
  const poster = media.find((m) => m.type === "photo" && m.role === "poster");
  const category = testimonialCategories.find((c) => c.toLowerCase() === (r.category ?? "").trim().toLowerCase()) ?? "General Experience";
  return {
    id: r.id,
    category,
    name: r.authorName,
    city: r.city ?? "",
    quote: r.body,
    rating: r.rating ?? undefined,
    photo: photo ? absoluteMediaUrl(photo.url) : undefined,
    beforePhoto: before ? absoluteMediaUrl(before.url) : undefined,
    afterPhoto: after ? absoluteMediaUrl(after.url) : undefined,
    type: video ? "video" : photo || (before && after) ? "photo" : "text",
    videoUrl: video ? absoluteMediaUrl(video.url) : undefined,
    poster: poster ? absoluteMediaUrl(poster.url) : undefined,
    placements: r.placements?.length ? r.placements : ["home"],
    verified: r.verifiedPurchase,
    consent: r.consentGiven,
    published: r.status === "PUBLISHED",
  };
}

let cache: Testimonial[] = [];
const SERVER_SNAPSHOT: Testimonial[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function load() {
  if (loaded || !isBackendConfigured() || !HOSTINGER_API_BASE_URL) return;
  loaded = true;
  try {
    const res = await fetch(`${HOSTINGER_API_BASE_URL}${API_ENDPOINTS.publicReviews}`, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!res.ok) { loaded = false; console.warn(`Store server: customer stories not loaded (${res.status})`); return; }
    const body = (await res.json()) as { reviews?: AdminReview[] };
    const next = (body.reviews ?? []).map(reviewToTestimonial);
    if (JSON.stringify(next) !== JSON.stringify(cache)) { cache = next; emit(); }
  } catch (e) {
    loaded = false; // try again on the next page that needs it
    console.warn("Store server: customer stories not loaded", e);
    // no stories rather than invented ones
  }
}

export const liveStoriesStore = {
  subscribe: (fn: () => void) => { listeners.add(fn); void load(); return () => { listeners.delete(fn); }; },
  get: (): Testimonial[] => cache,
  server: (): Testimonial[] => SERVER_SNAPSHOT,
  refresh: () => { loaded = false; void load(); },
};
