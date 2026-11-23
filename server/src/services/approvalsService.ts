import type { PrismaClient } from "@prisma/client";

import type { Config } from "../config.js";
import { codProblems, shippingProblems } from "../lib/settingsSchema.js";
import type { Mailer } from "./mailer.js";
import type { MediaService } from "./mediaService.js";
import type { SettingsService } from "./settingsService.js";

export interface ApprovalItem {
  key: string;
  label: string;
  /** true only when the fact itself exists — never ticked by hand */
  confirmed: boolean;
  detail: string;
}

/**
 * The pre-launch checklist, worked out from what is actually in the database and the server's own
 * configuration. Nothing here is a box someone can tick: an item only reads confirmed when the fact
 * behind it exists (a shipping rule that is complete, a mail server that is configured, a product that
 * has pictures).
 */
export function createApprovalsService(
  prisma: PrismaClient,
  config: Config,
  settings: SettingsService,
  mailer: Mailer,
  media: MediaService,
) {
  async function checklist(): Promise<{ items: ApprovalItem[]; confirmed: number; total: number }> {
    const [shipping, cod, store, mediaCheck, active, published, contentRows] = await Promise.all([
      settings.shipping(),
      settings.cod(),
      settings.store(),
      media.inspect(),
      prisma.product.findMany({
        where: { status: "ACTIVE" },
        select: { name: true, _count: { select: { images: true, variants: true } } },
      }),
      prisma.review.count({ where: { status: "PUBLISHED", consentGiven: true, verifiedPurchase: true } }),
      prisma.siteContent.findMany({ select: { key: true, value: true } }),
    ]);

    const shippingGaps = shippingProblems(shipping);
    const codGaps = codProblems(cod);
    const incomplete = active.filter((p) => p._count.images === 0 || p._count.variants === 0).map((p) => p.name);
    const reviewed = contentRows.find((c) => c.key === "content.reviewed")?.value === true;

    const items: ApprovalItem[] = [
      {
        key: "shipping",
        label: "Delivery charges are set",
        confirmed: shippingGaps.length === 0,
        detail: shippingGaps.length ? shippingGaps.join(" ") : "Delivery rules are complete, so checkout can price an order.",
      },
      {
        key: "cod",
        label: "Cash on Delivery rules are set",
        confirmed: codGaps.length === 0,
        detail: codGaps.length ? codGaps.join(" ") : "Cash on Delivery is available with the owner's rules.",
      },
      {
        key: "razorpay",
        label: "Online payment is connected",
        confirmed: config.razorpay !== null,
        detail: config.razorpay ? `Razorpay ${config.razorpay.mode} keys are configured.` : "Add Razorpay keys on the server to take online payments.",
      },
      {
        key: "email",
        label: "Email can be sent",
        confirmed: mailer.configured,
        detail: mailer.configured ? "The mail server is configured." : "SMTP isn't configured: confirmation and recovery links are written to the server's outbox folder instead of being sent.",
      },
      {
        key: "google",
        label: "Sign-in with Google is connected",
        confirmed: config.google !== null,
        detail: config.google ? "Google credentials are configured." : "Add the Google credentials on the server to offer sign-in with Google.",
      },
      {
        key: "store",
        label: "Store contact details are set",
        confirmed: Boolean(store.contactEmail && store.contactPhone),
        detail: store.contactEmail && store.contactPhone ? "A contact email and phone are on the store settings." : "Add the store's contact email and phone.",
      },
      {
        key: "products",
        label: "Every listed product has pictures and a price",
        confirmed: active.length > 0 && incomplete.length === 0,
        detail: active.length === 0 ? "No products are listed yet." : incomplete.length ? `Missing pictures or a price: ${incomplete.slice(0, 6).join(", ")}${incomplete.length > 6 ? "…" : ""}` : `${active.length} listed products are complete.`,
      },
      {
        key: "media",
        label: "Stored files are all present",
        confirmed: mediaCheck.rowsWithoutFile.length === 0,
        detail: mediaCheck.rowsWithoutFile.length
          ? `${mediaCheck.rowsWithoutFile.length} file record(s) can't find their copy on disk.`
          : `${mediaCheck.tracked} file(s) tracked, all present on disk.`,
      },
      {
        key: "stories",
        label: "Customer stories are ready to show",
        confirmed: published > 0,
        detail: published ? `${published} published story(ies) with consent and a verified purchase.` : "No published stories yet — add them under Customer stories.",
      },
      {
        key: "content",
        label: "Website wording has been reviewed",
        confirmed: reviewed,
        detail: reviewed ? "The owner recorded that the wording has been read through." : "Read the wording on the website content screen, then save the review flag there.",
      },
    ];

    const confirmed = items.filter((i) => i.confirmed).length;
    return { items, confirmed, total: items.length };
  }

  return { checklist };
}

export type ApprovalsService = ReturnType<typeof createApprovalsService>;
