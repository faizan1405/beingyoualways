// Testimonials repository (demo; swap for Hostinger REST later).
// Only `verified && consent && published` entries are ever shown publicly.
// Reviews can hold a customer's name and photo, so they are kept in sessionStorage
// (survive a refresh, cleared when the tab closes) — never in localStorage.
import { createDemoStore, isArrayOf, isObject } from "@/lib/demo-store";
import { seedPhotoStories, seedVideoReviews, type PhotoStory, type VideoReview } from "@/content/customer-media";

export type TestimonialCategory = "Skin" | "Hair" | "Pigmentation" | "De-Tan" | "General Experience";
export const testimonialCategories: TestimonialCategory[] = ["Skin", "Hair", "Pigmentation", "De-Tan", "General Experience"];

export type TestimonialPlacement = "home" | "explore";
export const testimonialPlacements: { key: TestimonialPlacement; label: string }[] = [
  { key: "home", label: "Homepage" },
  { key: "explore", label: "Explore by Concern" },
];

export interface Testimonial {
  id: string;
  category: TestimonialCategory;
  name: string;
  city: string;
  quote: string;
  rating?: number | undefined;
  photo?: string | undefined;
  /** Before / after pair (only with written permission). */
  beforePhoto?: string | undefined;
  afterPhoto?: string | undefined;
  type?: "text" | "photo" | "video" | undefined;
  /** Hosted video link (kept) or a temporary blob: preview of a chosen file (this page only). */
  videoUrl?: string | undefined;
  /** Name of a chosen video file — the file itself is NOT uploaded or saved. */
  videoFileName?: string | undefined;
  poster?: string | undefined;
  productSlug?: string | undefined;
  /** Where it may appear; defaults to the homepage. */
  placements?: TestimonialPlacement[] | undefined;
  verified: boolean;
  consent: boolean;
  published: boolean;
}

export const isTemporaryVideo = (url?: string) => !!url && url.startsWith("blob:");

/** Video stories need a playable link; everything needs verified + consent + published. */
export const isPublic = (t: Testimonial) => t.verified && t.consent && t.published && (t.type !== "video" || !!t.videoUrl);
export const showsOn = (t: Testimonial, where: TestimonialPlacement) => (t.placements?.length ? t.placements : ["home"]).includes(where);
/** Brand-published media (photo sets / video reviews): shown only with consent + published. */
export const isPublicMedia = (m: { consent: boolean; published: boolean }) => m.consent && m.published;

export type { PhotoStory, VideoReview };

const legacyCategory = (c: unknown): TestimonialCategory =>
  c === "Pigmentation / De-Tan" ? "Pigmentation" : testimonialCategories.includes(c as TestimonialCategory) ? (c as TestimonialCategory) : "General Experience";

export const testimonialStore = createDemoStore<Testimonial[]>({
  key: "bya.demo.testimonials", label: "Customer stories", version: 2, scope: "session",
  seed: () => [],
  validate: (v): v is Testimonial[] => isArrayOf<Testimonial>(v, (t) => typeof t["id"] === "string" && typeof t["quote"] === "string" && testimonialCategories.includes(t["category"] as TestimonialCategory)),
  migrate: (old) => (Array.isArray(old) ? old.map((t) => ({ ...(t as Testimonial), category: legacyCategory((t as { category?: unknown }).category) })) : null),
  // A chosen video file only plays in this page; after a refresh the admin must add a hosted link.
  serialize: (list) => list.map((t) => (isTemporaryVideo(t.videoUrl) ? { ...t, videoUrl: undefined } : t)),
});

/** Publish toggles for brand-published media (no personal data — kept in localStorage). */
interface MediaFlags { photos: Record<string, boolean>; videos: Record<string, boolean> }
export const mediaStore = createDemoStore<MediaFlags>({
  key: "bya.demo.media", label: "Customer media visibility", version: 1,
  seed: () => ({ photos: {}, videos: {} }),
  validate: (v): v is MediaFlags => isObject(v) && isObject(v["photos"]) && isObject(v["videos"]),
});

// Stable snapshots: rebuilt only when the flags change.
let flagsRef = mediaStore.get();
let photoCache = applyFlags(seedPhotoStories, flagsRef.photos);
let videoCache = applyFlags(seedVideoReviews, flagsRef.videos);
function applyFlags<T extends { id: string; published: boolean }>(list: T[], flags: Record<string, boolean>): T[] {
  return list.map((x) => (x.id in flags ? { ...x, published: !!flags[x.id] } : x));
}
const refresh = () => {
  const f = mediaStore.get();
  if (f !== flagsRef) { flagsRef = f; photoCache = applyFlags(seedPhotoStories, f.photos); videoCache = applyFlags(seedVideoReviews, f.videos); }
};

/** Customer photo sets and video reviews migrated from the brand's site. */
export const customerMediaService = {
  photoStories: () => { refresh(); return photoCache; },
  videoReviews: () => { refresh(); return videoCache; },
  serverPhotoStories: () => seedPhotoStories,
  serverVideoReviews: () => seedVideoReviews,
  setPhotoPublished: (id: string, published: boolean) => mediaStore.set((f) => ({ ...f, photos: { ...f.photos, [id]: published } })),
  setVideoPublished: (id: string, published: boolean) => mediaStore.set((f) => ({ ...f, videos: { ...f.videos, [id]: published } })),
  subscribe: mediaStore.subscribe,
};

export function validateTestimonial(t: Testimonial): string[] {
  const e: string[] = [];
  if (!t.name.trim()) e.push("Add the customer's name.");
  if (!t.quote.trim()) e.push("Add the customer's exact words.");
  if (t.type === "video" && !t.videoUrl) e.push("Add a video link or choose a video file.");
  if (t.type === "video" && t.videoUrl && !isTemporaryVideo(t.videoUrl) && !/^https:\/\//.test(t.videoUrl)) e.push("Video links must start with https://");
  if (t.published && !(t.verified && t.consent)) e.push("A review can only be published once it is verified and the customer has given permission.");
  if (t.published && !(t.placements?.length ?? 1)) e.push("Choose at least one place for it to appear.");
  return e;
}

export const testimonialService = {
  all: () => testimonialStore.get(),
  server: () => testimonialStore.server(),
  publicList: () => testimonialStore.get().filter(isPublic),
  save: (t: Testimonial) => {
    const errors = validateTestimonial(t);
    if (errors.length) throw new Error(errors.join(" "));
    testimonialStore.set((all) => (all.some((x) => x.id === t.id) ? all.map((x) => (x.id === t.id ? t : x)) : [t, ...all]));
  },
  remove: (id: string) => testimonialStore.set((all) => all.filter((x) => x.id !== id)),
  subscribe: testimonialStore.subscribe,
};
