// Four-slide product infographics (01 product photo, 02 Who is it for?, 03 What's inside?,
// 04 How to use). Wording + status live in infographics.json; the editable layouts and the
// render script live in design/gallery-slides/.
// - "ready":   shown to shoppers. Wording comes from the genuine pack photos, the client sheet or
//              the original listing; where exact directions are missing, How to use is a common
//              category guide (guide: "general"), which the client allowed (Nov 2026).
// - "preview": legacy state, treated like ready.
// - "draft":   admin only; the shop keeps the previous gallery.
import data from "./infographics.json";

export type InfographicStatus = "ready" | "preview" | "draft";
/** Where the How to use steps come from: pack/client directions or a common category guide. */
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
  // Slides keep word joiners (U+2060) so "10–15" never breaks across lines; data stays plain.
  steps: (p.how.steps ?? []).map((s) => ({ title: s.title, text: s.text.replace(/\u2060/g, "") })),
  missing: p.missing, uncertain: p.uncertain, sources: p.sources,
}));

export const infographicFor = (slug: string) => infographics.find((x) => x.slug === slug);
/** Live for shoppers. */
export const isInfographicReady = (slug: string) => infographicFor(slug)?.status === "ready";
/** Shown to shoppers (ready, or the legacy preview state). */
export const isInfographicShown = (slug: string) => {
  const s = infographicFor(slug)?.status;
  return s === "ready" || s === "preview";
};
