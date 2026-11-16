// Four-slide product infographics (01 product photo, 02 Who is it for?, 03 What's inside?,
// 04 How to use). Wording + status live in infographics.json; the editable layouts and the
// render script live in design/gallery-slides/. Only "ready" sets reach shoppers — a draft
// set is shown in admin with what is missing, and the shop keeps the previous gallery.
import data from "./infographics.json";

export type InfographicStatus = "ready" | "draft";

export interface InfographicEntry {
  slug: string;
  status: InfographicStatus;
  eyebrow: string;
  /** Facts needed before the set can go live. */
  missing: string[];
  /** Notes on facts left off or needing confirmation (internal). */
  uncertain: string[];
  sources: { who: string; inside: string; how: string };
}

export const infographics: InfographicEntry[] = (data.products as unknown as InfographicEntry[]).map((p) => ({
  slug: p.slug, status: p.status, eyebrow: p.eyebrow, missing: p.missing, uncertain: p.uncertain, sources: p.sources,
}));

export const infographicFor = (slug: string) => infographics.find((x) => x.slug === slug);
export const isInfographicReady = (slug: string) => infographicFor(slug)?.status === "ready";
