// Policy text migrated verbatim from beingyoualways.com (WordPress page content, page-builder
// shortcodes and empty spacer paragraphs removed only). Legal approval is tracked separately:
// copying the source text does NOT make a policy legally approved.
import raw from "./policies.json";

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
