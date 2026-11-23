// Editable storefront content (demo). Defaults come from the verified facts in
// config/business.ts; admin edits are saved in this browser and shown on the storefront
// after it loads. Legal policies are NOT editable here. Swap for Hostinger CMS calls later.
import { aboutContent, contactConfig } from "@/config/business";
import { faqs as defaultFaqs } from "@/content/faqs";
import { homeCategoryGroups } from "@/lib/concerns";
import { createDemoStore, isObject } from "@/lib/demo-store";

export const HOME_SECTIONS = [
  { key: "shopByConcern", label: "Shop by concern" },
  { key: "categoryShop", label: "Shop by category" },
  { key: "bestSeller", label: "Best Seller" },
  { key: "ourStory", label: "Our story" },
  { key: "scrollStory", label: "The beauty of being you (scroll story)" },
  { key: "collections", label: "Featured collections" },
  { key: "testimonials", label: "Customer stories" },
  { key: "videos", label: "Customer videos" },
  { key: "globalStandards", label: "Global Standards" },
  { key: "whyChooseUs", label: "What we stand for" },
  { key: "founder", label: "Founder quote" },
  { key: "faq", label: "FAQs" },
  { key: "contact", label: "Contact band" },
  { key: "newsletter", label: "Newsletter" },
] as const;
export type HomeSectionKey = (typeof HOME_SECTIONS)[number]["key"];

export const PROMO_LINKS = [
  { to: "/shop", label: "Shop all" },
  { to: "/skincare", label: "Skin Care" },
  { to: "/haircare", label: "Hair Care" },
  { to: "/de-tan-care", label: "De-Tan Care" },
  { to: "/colour-cosmetics", label: "Cosmetics" },
  { to: "/combos", label: "Combos" },
  { to: "/explore-concerns", label: "Explore by Concern" },
] as const;
export type PromoLink = (typeof PROMO_LINKS)[number]["to"];

export interface ContactPhone { label: string; display: string; tel: string }
export interface SiteContent {
  announcement: { enabled: boolean; text: string };
  promo: { enabled: boolean; heading: string; text: string; image: string | null; linkTo: PromoLink; linkLabel: string };
  categoryOrder: string[];
  hiddenCollections: string[];
  sections: Record<HomeSectionKey, boolean>;
  about: { story: string[]; mission: string; vision: string; signoff: string };
  contact: { phones: ContactPhone[]; email: string; addressLines: string[] };
  faqs: { q: string; a: string }[];
}

export const defaultContent = (): SiteContent => ({
  // Off by default — the client asked for the thin top bar to be removed.
  announcement: { enabled: false, text: "" },
  promo: { enabled: false, heading: "", text: "", image: null, linkTo: "/shop", linkLabel: "Shop now" },
  categoryOrder: homeCategoryGroups.map((g) => g.key),
  hiddenCollections: [],
  sections: Object.fromEntries(HOME_SECTIONS.map((s) => [s.key, true])) as Record<HomeSectionKey, boolean>,
  about: { story: [...aboutContent.story], mission: aboutContent.mission, vision: aboutContent.vision, signoff: aboutContent.signoff },
  contact: { phones: contactConfig.phones.map((p) => ({ ...p })), email: contactConfig.email, addressLines: [...contactConfig.addressLines] },
  faqs: defaultFaqs.map((f) => ({ ...f })),
});

export const contentStore = createDemoStore<SiteContent>({
  key: "bya.demo.content", label: "Website content", version: 1,
  seed: defaultContent,
  validate: (v): v is SiteContent => isObject(v) && isObject(v["sections"]) && isObject(v["about"]) && isObject(v["contact"]) && Array.isArray(v["faqs"]),
});

export const telFrom = (display: string) => { const d = display.replace(/[^0-9+]/g, ""); return d.startsWith("+") ? d : `+91${d}`; };
export const mapsUrlFor = (lines: string[]) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lines.join(", "))}`;

export function validateContent(c: SiteContent): string[] {
  const e: string[] = [];
  if (c.announcement.enabled && !c.announcement.text.trim()) e.push("Write the announcement text, or switch it off.");
  if (c.announcement.text.length > 120) e.push("Keep the announcement under 120 characters.");
  if (c.promo.enabled && !c.promo.heading.trim()) e.push("Add a heading for the promotional banner, or switch it off.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.contact.email.trim())) e.push("Enter a valid contact email.");
  if (c.contact.phones.length === 0 || c.contact.phones.some((p) => p.display.replace(/\D/g, "").length < 10)) e.push("Each contact number needs at least 10 digits.");
  if (c.contact.addressLines.filter((l) => l.trim()).length === 0) e.push("Business address can't be empty.");
  if (c.about.story.filter((p) => p.trim()).length === 0) e.push("About Us needs at least one paragraph.");
  if (c.faqs.some((f) => !f.q.trim() || !f.a.trim())) e.push("Every FAQ needs a question and an answer.");
  return e;
}

export const contentService = {
  get: () => contentStore.get(),
  save: (c: SiteContent) => {
    const clean: SiteContent = {
      ...c,
      contact: { ...c.contact, phones: c.contact.phones.map((p) => ({ ...p, tel: telFrom(p.display) })), addressLines: c.contact.addressLines.filter((l) => l.trim()) },
      about: { ...c.about, story: c.about.story.filter((p) => p.trim()) },
    };
    const errors = validateContent(clean);
    if (errors.length) throw new Error(errors.join(" "));
    contentStore.set(clean);
  },
};
