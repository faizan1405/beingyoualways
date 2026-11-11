// Internal client-approval checklist. Each item's status is worked out from the
// live data and config flags, so ticking something here is never manual — it
// only turns "Confirmed" when the underlying fact has actually been supplied.
import { BRAND_CLAIMS_CONFIRMED, COD_RULES_CONFIRMED, INVENTORY_CONNECTED, SHIPPING_RATES_CONFIRMED, contactConfig } from "@/config/business";
import { policyReview } from "@/content/policies";
import { APPROVED_THEME, THEMES, THEME_CHOICE_CONFIRMED } from "@/lib/theme-preview";
import { isUnconfirmed } from "@/lib/variants";
import type { Product } from "@/lib/types";

export type ApprovalStatus = "confirmed" | "partial" | "waiting";

export interface ApprovalItem {
  id: string;
  title: string;
  status: ApprovalStatus;
  /** What the site has today. */
  current: string;
  /** What we need from the client. */
  needed: string;
  /** Where it shows up / what it unlocks. */
  affects: string;
  /** Products still missing this fact (names), when relevant. */
  missing?: string[];
  adminLink?: "/admin/products" | "/admin/testimonials" | "/admin/settings";
}

interface Inputs {
  products: Product[];
  publicReviewCount: number;
  shippingConfirmed?: boolean;
  codConfirmed?: boolean;
  inventoryConnected?: boolean;
  whatsappNumber?: string | null;
  claimsConfirmed?: boolean;
  themeConfirmed?: boolean;
}

const productStatus = (missing: number, total: number): ApprovalStatus =>
  missing === 0 ? "confirmed" : missing === total ? "waiting" : "partial";

export function buildApprovalChecklist({
  products,
  publicReviewCount,
  shippingConfirmed = SHIPPING_RATES_CONFIRMED,
  codConfirmed = COD_RULES_CONFIRMED,
  inventoryConnected = INVENTORY_CONNECTED,
  whatsappNumber = contactConfig.whatsappNumber,
  claimsConfirmed = BRAND_CLAIMS_CONFIRMED,
  themeConfirmed = THEME_CHOICE_CONFIRMED,
}: Inputs): ApprovalItem[] {
  const live = products.filter((p) => p.status === "active");
  const n = live.length;
  const noSize = live.filter((p) => p.variants.some((v) => v.kind === "size" && isUnconfirmed(v.label)));
  const noIng = live.filter((p) => p.ingredients.length === 0);
  const noUse = live.filter((p) => isUnconfirmed(p.directions));
  const policiesOk = policyReview.refund.legallyApproved && policyReview.privacy.legallyApproved;
  const names = (l: Product[]) => l.map((p) => p.name);

  return [
    {
      id: "sizes", title: "Product sizes", status: productStatus(noSize.length, n),
      current: noSize.length ? `${noSize.length} of ${n} live products have a size marked "to be confirmed" (hidden from shoppers).` : `All ${n} live products have a confirmed size or shade.`,
      needed: "Net quantity (ml / g) for each product, exactly as printed on the pack.",
      affects: "Size chip on product pages, bag and checkout.", missing: names(noSize), adminLink: "/admin/products",
    },
    {
      id: "ingredients", title: "Ingredients", status: productStatus(noIng.length, n),
      current: noIng.length ? `${noIng.length} of ${n} live products have no ingredient list.` : "Every live product has an ingredient list.",
      needed: "Full ingredient list for each product, from the label.",
      affects: "\"Ingredients\" section on product pages (hidden while empty).", missing: names(noIng), adminLink: "/admin/products",
    },
    {
      id: "usage", title: "Usage instructions", status: productStatus(noUse.length, n),
      current: noUse.length ? `${noUse.length} of ${n} live products have no "How to use" text.` : "Every live product has usage instructions.",
      needed: "How to use / directions for each product.",
      affects: "\"How to use\" section on product pages (hidden while empty).", missing: names(noUse), adminLink: "/admin/products",
    },
    {
      id: "inventory", title: "Actual inventory", status: inventoryConnected ? "confirmed" : "waiting",
      current: "Stock numbers are demo values. Shoppers only see \"Available to order\" or \"Currently unavailable\"; bags are capped at a demo limit per item.",
      needed: "Real stock levels per size/shade, and how inventory will be updated (Hostinger backend).",
      affects: "Availability messages and the per-item bag limit.", adminLink: "/admin/products",
    },
    {
      id: "shipping", title: "Shipping charges", status: shippingConfirmed ? "confirmed" : "waiting",
      current: shippingConfirmed ? "Shipping rates confirmed." : "Shipping shows as \"Pending confirmation\" and no final total is shown. Sample ₹79 / free above ₹999 is admin-only.",
      needed: "Shipping fee, free-shipping threshold (if any) and delivery timelines.",
      affects: "Bag and checkout totals, shipping policy.",
    },
    {
      id: "cod", title: "COD eligibility", status: codConfirmed ? "confirmed" : "waiting",
      current: "Cash on Delivery is shown as an option marked \"pending approval\".",
      needed: "Whether COD is offered, any order-value or PIN-code limits, and any COD charge.",
      affects: "Payment step at checkout.",
    },
    {
      id: "policies", title: "Refund and privacy policies", status: policiesOk ? "confirmed" : "waiting",
      current: `Migrated word-for-word from the old site but not legally approved. Refund: ${policyReview.refund.flags.length} issue(s); Privacy: ${policyReview.privacy.flags.length} issue(s).`,
      needed: "Real refund/return/cancellation terms and a privacy policy covering orders, payments, phone numbers and WhatsApp — approved by the client.",
      affects: "Refund & Returns and Privacy Policy pages, checkout and sign-in links.",
    },
    {
      id: "reviews", title: "Verified customer reviews", status: publicReviewCount > 0 ? "partial" : "waiting",
      current: publicReviewCount > 0 ? `${publicReviewCount} review(s) marked verified + consented + published.` : "No reviews are published — the homepage shows an empty state.",
      needed: "Genuine reviews with each customer's written permission (and photo/video consent where used).",
      affects: "Homepage customer stories.", adminLink: "/admin/testimonials",
    },
    {
      id: "whatsapp", title: "WhatsApp Business number", status: whatsappNumber ? "confirmed" : "waiting",
      current: whatsappNumber ? `Set to ${whatsappNumber}.` : "Not set — no WhatsApp buttons link to a number yet.",
      needed: "Which number is registered on WhatsApp Business (and API access, for automated messages).",
      affects: "WhatsApp contact links, OTP sign-in and marketing tools.", adminLink: "/admin/settings",
    },
    {
      id: "claims", title: "Brand claims & ingredient sourcing", status: claimsConfirmed ? "confirmed" : "waiting",
      current: claimsConfirmed
        ? "Client has confirmed the What We Stand For and Global Standards wording."
        : "\"What We Stand For\" (Paraben Free, Natural, Cruelty-Free — suitable for all skin types, never tested on animals, eco-conscious packaging) and \"Global Standards\" (six country flags) are shown word-for-word from the old site but are not verified.",
      needed: "Written confirmation that each claim is true for every product, plus which ingredients come from India, South Korea, Spain, Brazil, Germany and the United States. Supporting documents if any certification is to be mentioned.",
      affects: "Homepage \"What We Stand For\" and \"Global Standards\" sections.",
    },
      {
      id: "theme", title: "Website theme (Clean White)", status: themeConfirmed ? "confirmed" : "waiting",
      current: themeConfirmed
        ? `Client chose ${THEMES[APPROVED_THEME].label}.`
        : `Shoppers see ${THEMES[APPROVED_THEME].label}. The client has not confirmed it yet.`,
      needed: "The client's final choice after comparing both options on phone and desktop.",
      affects: "Background and surface colours across the storefront (layout, content and colour-story scenes stay the same).", adminLink: "/admin/settings",
    },
  ];
}
