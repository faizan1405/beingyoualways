import { percentOf, type Paise } from "./money.js";
import { inRegion, type CodSettings, type ShippingSettings } from "./settingsSchema.js";

// Pure price rules (no database) so every total can be unit-tested. Inputs are database values in paise.

export interface PricedLine {
  productId: string;
  variantId: string;
  categorySlug: string;
  productName: string;
  variantLabel: string;
  unitPaise: Paise;
  quantity: number;
}

export interface DiscountRule {
  code: string;
  type: "PERCENT" | "FIXED";
  /** PERCENT: percent off (e.g. 10 = 10 %). FIXED: paise off. */
  value: number;
  minOrderPaise: Paise | null;
  maxDiscountPaise: Paise | null;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
  active: boolean;
  productIds: string[] | null;
  categorySlugs: string[] | null;
}

export type DiscountResult = { ok: true; amountPaise: Paise } | { ok: false; reason: string };

export const lineTotal = (l: Pick<PricedLine, "unitPaise" | "quantity">): Paise => l.unitPaise * l.quantity;
export const subtotalOf = (lines: PricedLine[]): Paise => lines.reduce((s, l) => s + lineTotal(l), 0);

export function evaluateDiscount(d: DiscountRule, lines: PricedLine[], now: Date): DiscountResult {
  if (!d.active) return { ok: false, reason: "This discount code isn't active." };
  if (d.startsAt && now < d.startsAt) return { ok: false, reason: "This discount code isn't valid yet." };
  if (d.endsAt && now > d.endsAt) return { ok: false, reason: "This discount code has expired." };
  if (d.usageLimit != null && d.usedCount >= d.usageLimit) return { ok: false, reason: "This discount code has been fully used." };
  const subtotal = subtotalOf(lines);
  if (d.minOrderPaise != null && subtotal < d.minOrderPaise) return { ok: false, reason: `This code needs a minimum order of ₹${(d.minOrderPaise / 100).toLocaleString("en-IN")}.` };
  const eligible = lines.filter((l) => (!d.productIds?.length || d.productIds.includes(l.productId)) && (!d.categorySlugs?.length || d.categorySlugs.includes(l.categorySlug)));
  const base = subtotalOf(eligible);
  if (base === 0) return { ok: false, reason: "This code doesn't apply to the items in your bag." };
  let amount = d.type === "PERCENT" ? percentOf(base, d.value) : Math.round(d.value);
  if (d.maxDiscountPaise != null) amount = Math.min(amount, d.maxDiscountPaise);
  amount = Math.max(0, Math.min(amount, base));
  return { ok: true, amountPaise: amount };
}

export interface Totals { subtotalPaise: Paise; discountPaise: Paise; shippingPaise: Paise; codFeePaise: Paise; totalPaise: Paise }

/** Shipping is charged on the amount after discount; free above the owner's threshold when one is set. */
export function shippingFee(s: ShippingSettings, afterDiscount: Paise): Paise {
  if (s.flatFeePaise == null) throw new Error("Shipping charge is not configured.");
  if (s.freeAbovePaise != null && afterDiscount >= s.freeAbovePaise) return 0;
  return s.flatFeePaise;
}

export function computeTotals(input: { lines: PricedLine[]; discountPaise: Paise; shipping: ShippingSettings; codFeePaise: Paise }): Totals {
  const subtotalPaise = subtotalOf(input.lines);
  const discountPaise = Math.min(input.discountPaise, subtotalPaise);
  const shippingPaise = shippingFee(input.shipping, subtotalPaise - discountPaise);
  const totalPaise = subtotalPaise - discountPaise + shippingPaise + input.codFeePaise;
  return { subtotalPaise, discountPaise, shippingPaise, codFeePaise: input.codFeePaise, totalPaise };
}

/** Why COD can't be used for this order (null = allowed). Checked against the amount before the COD fee. */
export function codBlocker(c: CodSettings, orderPaise: Paise, dest: { state: string; pincode: string } | undefined): string | null {
  if (!c.enabled || c.feePaise == null) return "Cash on Delivery isn't available right now.";
  if (c.minOrderPaise != null && orderPaise < c.minOrderPaise) return `Cash on Delivery is available on orders of ₹${(c.minOrderPaise / 100).toLocaleString("en-IN")} or more.`;
  if (c.maxOrderPaise != null && orderPaise > c.maxOrderPaise) return `Cash on Delivery is available on orders up to ₹${(c.maxOrderPaise / 100).toLocaleString("en-IN")}.`;
  if (dest && !inRegion(c.regions, dest.state, dest.pincode)) return "Cash on Delivery isn't available for this PIN code.";
  return null;
}
