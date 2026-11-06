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
  verified: boolean; // review confirmed as genuine by the client
  consent: boolean; // customer agreed to public use (incl. photo)
  published: boolean;
}

let store: Testimonial[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const isPublic = (t: Testimonial) => t.verified && t.consent && t.published;

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
