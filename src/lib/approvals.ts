// Internal client-approval checklist. Each item's status is worked out from the
// live data and config flags, so ticking something here is never manual — it
// only turns "Confirmed" when the underlying fact has actually been supplied.
import { BRAND_CLAIMS_CONFIRMED, COD_RULES_CONFIRMED, INVENTORY_CONNECTED, SHIPPING_RATES_CONFIRMED, contactConfig } from "@/config/business";
import { policyReview } from "@/content/policies";
import { PRODUCT_SHEET_CLAIMS_CONFIRMED, flaggedPoints, pendingPhotos } from "@/content/product-sheet";
import { infographicFor } from "@/content/infographics";
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
  sheetClaimsConfirmed?: boolean;
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
  sheetClaimsConfirmed = PRODUCT_SHEET_CLAIMS_CONFIRMED,
}: Inputs): ApprovalItem[] {
  const live = products.filter((p) => p.status === "active");
  const n = live.length;
  const noSize = live.filter((p) => p.variants.some((v) => v.kind === "size" && isUnconfirmed(v.label)));
  const noIng = live.filter((p) => p.ingredients.length === 0);
  const noUse = live.filter((p) => isUnconfirmed(p.directions));
  const policiesOk = policyReview.refund.legallyApproved && policyReview.privacy.legallyApproved;
  const names = (l: Product[]) => l.map((p) => p.name);
  // A supplied photo counts as resolved once the admin has added it to that product's gallery.
  const openPhotos = pendingPhotos.filter((ph) => !products.find((p) => p.slug === ph.slug)?.images?.includes(ph.src));
  const unpricedDrafts = products.filter((p) => p.status === "draft" && !p.isSample && p.variants.every((v) => v.price <= 0));
  const awaiting = [...openPhotos.map((ph) => ph.label), ...unpricedDrafts.map((p) => `${p.name} — ${p.images?.length ? "price and size" : "price, size and photo"}`)];
  const flagged = flaggedPoints();
  const fdaCount = flagged.filter((f) => f.flag === "certification").length;
  const draftInfo = live.filter((p) => infographicFor(p.slug)?.status !== "ready");
  const generalInfo = live.filter((p) => infographicFor(p.slug)?.guide === "general");

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
      id: "sheet-claims", title: "Product sheet claims", status: sheetClaimsConfirmed ? "confirmed" : "waiting",
      current: sheetClaimsConfirmed
        ? "Client has supplied proof for the flagged product-sheet statements."
        : `${flagged.length} statements in the client's product sheet are recorded but not published — including "FDA approved" (${fdaCount} product groups), "available in Dubai", anti-aging / pigmentation / hair-growth results, "waterproof" and "suitable for all skin types".`,
      needed: "Proof for each statement before it can appear on the shop: FDA registration or certificate, where products are sold outside India, test results for SPF, waterproof and result claims.",
      affects: "Product descriptions and any future claim badges.", adminLink: "/admin/products",
    },
    {
      id: "product-review", title: "Supplied photos & draft products", status: awaiting.length === 0 ? "confirmed" : "waiting",
      current: awaiting.length
        ? `${openPhotos.length} supplied photo(s) could not be matched with certainty and are kept off the shop; ${unpricedDrafts.length} product(s) are hidden drafts with no price.`
        : "Every supplied photo is matched and no draft is waiting for a price.",
      needed: "Confirm whether each photo is the same product (and its size and price), and send Magic Drop's price, size and photo.",
      affects: "Product galleries, sizes and which products shoppers can buy.", missing: awaiting, adminLink: "/admin/products",
    },
    {
      id: "infographics", title: "Product infographic slides", status: productStatus(draftInfo.length, n),
      current: draftInfo.length
        ? `${n - draftInfo.length} of ${n} live products show the four-slide infographics. ${draftInfo.length} sets are drafts (admin only) — those products keep their previous photos.`
        : `All ${n} live products show the four-slide infographics. ${generalInfo.length} use a common category How to use guide (client allowed) because the pack's exact directions weren't available.`,
      needed: "Optional: send the manufacturer's directions for any product using a common guide, and confirm the flagged ingredients or sizes (listed on each product's edit page).",
      affects: "Product page galleries (Who is it for?, What's inside?, How to use).", missing: names(draftInfo), adminLink: "/admin/products",
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
