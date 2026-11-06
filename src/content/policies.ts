// Policy text migrated verbatim from beingyoualways.com (WordPress page content, page-builder
// shortcodes and empty spacer paragraphs removed only). Legal approval is tracked separately:
// copying the source text does NOT make a policy legally approved.
import raw from "./policies.json";
import { productImages } from "@/lib/product-images";

export type PolicyKey = "shipping" | "refund" | "privacy" | "terms" | "disclaimer";

export interface PolicyReview {
  /** Source text retrieved and copied unchanged. */
  migrated: boolean;
  /** Client/legal sign-off — keep false until the client confirms. */
  legallyApproved: false | true;
  /** Issues found while comparing with the source, for the client to resolve. */
  flags: string[];
}

export const policyReview: Record<PolicyKey, PolicyReview> = {
  shipping: { migrated: true, legallyApproved: false, flags: [
    "Names SHOP MITRA E TRADING PRIVATE LIMITED, not Being You – Always.",
    "Helpdesk email is a personal Gmail address (anirudhhrajput77@gmail.com), not info@beingyoualways.com.",
  ] },
  refund: { migrated: true, legallyApproved: false, flags: [
    "The original refund page contains only a brand statement — no refund, return or cancellation terms.",
    "The link https://beingyoualways.com/refund_returns/ returns 'Page not found'; the live page is /refund-and-returns-policy/.",
    "Same text as the Disclaimer page.",
  ] },
  privacy: { migrated: true, legallyApproved: false, flags: [
    "Appears to be the unedited WordPress sample privacy policy (each section begins with 'Suggested text:').",
    "Does not mention orders, payments, phone numbers or WhatsApp.",
  ] },
  terms: { migrated: true, legallyApproved: false, flags: [
    "Names SHOP MITRA E TRADING PRIVATE LIMITED with office at 66, Nijanand Park, Vastral — different from the Ved Arcade address shown elsewhere.",
  ] },
  disclaimer: { migrated: true, legallyApproved: false, flags: [
    "The original disclaimer page contains only a brand statement — no disclaimer terms.",
    "Same text as the Refund & Returns page.",
  ] },
};

export const policies = raw as Record<PolicyKey, { title: string; sourceUrl: string; sourceModified: string; html: string }>;

/** Page-specific hero (real catalogue photos only — each used on one policy page). */
export const policyHero: Record<PolicyKey, { subtitle: string; image: string | undefined; alt: string; pos: string }> = {
  shipping: { subtitle: "Information about how your orders are dispatched and delivered.", image: productImages("wax-powder-aloe-vera-gel-combo")[0], alt: "Being You herbal wax powder and aloe vera gel among fresh leaves", pos: "50% 55%" },
  refund: { subtitle: "Information about returns, refunds and customer assistance.", image: productImages("bright-banana-powder")[0], alt: "Being You Bright Banana powder with an open compact and puff", pos: "50% 50%" },
  privacy: { subtitle: "Information about how personal information is handled.", image: productImages("toner")[2], alt: "Being You fennel toner among fennel flowers", pos: "50% 40%" },
  terms: { subtitle: "Information about using our website and services.", image: productImages("true-base-liquid-foundation")[0], alt: "Being You True Base liquid foundation", pos: "50% 35%" },
  disclaimer: { subtitle: "Important information about our website and product content.", image: productImages("face-serum")[2], alt: "Being You face serum bottle", pos: "50% 40%" },
};

/** Internal review checklist — never auto-complete legal items. */
export const policyChecklist = (k: PolicyKey) => [
  { label: "Source text imported", done: policyReview[k].migrated },
  { label: "Visual redesign complete", done: true },
  { label: "Source-content comparison complete", done: true },
  { label: "Legal entity verified", done: false },
  { label: "Contact information verified", done: false },
  { label: "Client approval received", done: policyReview[k].legallyApproved },
];

/** Adds stable ids to <h2> headings for the table of contents; wording untouched. */
export function withHeadingIds(html: string) {
  const toc: { id: string; text: string }[] = [];
  const out = html.replace(/<h2>(.*?)<\/h2>/g, (_m, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, "");
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    toc.push({ id, text });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  return { html: out, toc };
}
