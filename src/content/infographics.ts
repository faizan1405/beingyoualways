// Four-slide product infographics (01 product photo, 02 Who is it for?, 03 What's inside?,
// 04 How to use). Wording + status live in infographics.json; the editable layouts and the
// render script live in design/gallery-slides/.
// - "ready":   every slide verified (How to use from the pack, client sheet or original listing).
// - "preview": slides 02–03 verified; How to use is a conservative general guide pending client
//              approval. Shown in the storefront preview, flagged in admin, never "approved".
// - "draft":   admin only; the shop keeps the previous gallery.
import data from "./infographics.json";

export type InfographicStatus = "ready" | "preview" | "draft";
/** Where the How to use steps come from: verified directions or a general category guide. */
export type HowGuide = "verified" | "general" | "none";

export interface InfographicEntry {
  slug: string;
  status: InfographicStatus;
  eyebrow: string;
  guide: HowGuide;
  /** How to use steps as shown on slide 04 (empty for drafts without steps). */
  steps: { title: string; text: string }[];
  /** Facts needed before the set counts as client-approved. */
  missing: string[];
  /** Notes on facts left off or needing confirmation (internal). */
  uncertain: string[];
  sources: { who: string; inside: string; how: string };
}

type RawEntry = Omit<InfographicEntry, "guide" | "steps"> & {
  how: { guide?: HowGuide; steps?: { title: string; text: string }[] };
};

export const infographics: InfographicEntry[] = (data.products as unknown as RawEntry[]).map((p) => ({
  slug: p.slug, status: p.status, eyebrow: p.eyebrow,
  guide: p.how.guide ?? "none",
  steps: (p.how.steps ?? []).map((s) => ({ title: s.title, text: s.text })),
  missing: p.missing, uncertain: p.uncertain, sources: p.sources,
}));

export const infographicFor = (slug: string) => infographics.find((x) => x.slug === slug);
/** Fully verified by the client's information. */
export const isInfographicReady = (slug: string) => infographicFor(slug)?.status === "ready";
/** Shown in the storefront preview: verified sets plus sets whose How to use is a general guide. */
export const isInfographicShown = (slug: string) => {
  const s = infographicFor(slug)?.status;
  return s === "ready" || s === "preview";
};
