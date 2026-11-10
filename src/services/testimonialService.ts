// Testimonials repository (in-memory demo; swap for Hostinger REST later).
// Only `verified && consent && published` entries are ever shown publicly.

export type TestimonialCategory = "Skin" | "Hair" | "Pigmentation / De-Tan" | "General Experience";
export const testimonialCategories: TestimonialCategory[] = ["Skin", "Hair", "Pigmentation / De-Tan", "General Experience"];

export interface Testimonial {
  id: string;
  category: TestimonialCategory;
  name: string;
  city: string;
  quote: string;
  rating?: number | undefined;
  photo?: string | undefined;
  type?: "text" | "photo" | "video" | undefined; // defaults to text/photo by presence of media
  videoUrl?: string | undefined; // backend-hosted video URL (local blob URLs are demo-only)
  poster?: string | undefined; // video thumbnail
  productSlug?: string | undefined; // related product
  verified: boolean; // review confirmed as genuine by the client
  consent: boolean; // customer agreed to public use (incl. photo)
  published: boolean;
}

import { seedPhotoStories, seedVideoReviews, type PhotoStory, type VideoReview } from "@/content/customer-media";

let store: Testimonial[] = [];
let photoStories: PhotoStory[] = seedPhotoStories;
let videoReviews: VideoReview[] = seedVideoReviews;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const isPublic = (t: Testimonial) => t.verified && t.consent && t.published;
/** Brand-published media (photo sets / video reviews): shown only with consent + published. */
export const isPublicMedia = (m: { consent: boolean; published: boolean }) => m.consent && m.published;

export type { PhotoStory, VideoReview };

/** Customer photo sets and video reviews migrated from the brand's site. Demo toggles reset on reload. */
export const customerMediaService = {
  photoStories: () => photoStories,
  videoReviews: () => videoReviews,
  setPhotoPublished: (id: string, published: boolean) => { photoStories = photoStories.map((p) => (p.id === id ? { ...p, published } : p)); emit(); },
  setVideoPublished: (id: string, published: boolean) => { videoReviews = videoReviews.map((v) => (v.id === id ? { ...v, published } : v)); emit(); },
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
};

export const testimonialService = {
  all: () => store,
  publicList: () => store.filter(isPublic),
  save: (t: Testimonial) => {
    store = store.some((x) => x.id === t.id) ? store.map((x) => (x.id === t.id ? t : x)) : [t, ...store];
    emit();
  },
  remove: (id: string) => { store = store.filter((x) => x.id !== id); emit(); },
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
};
