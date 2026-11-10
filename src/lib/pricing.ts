// Central pricing rules for the storefront. Every bag, drawer, checkout and
// review screen reads totals from here — never calculate prices in components.
import { SHIPPING_RATES_CONFIRMED } from "@/config/business";
import type { OrderSummary, ShippingStatus } from "@/lib/types";

/** Most units of one product variant a single bag line may hold (prototype rule). */
export const MAX_QTY_PER_LINE = 10;

// Sample rates kept for admin reference only; not charged or advertised until the client confirms them.
export const FREE_SHIPPING_THRESHOLD = 999;
export const SHIPPING_FEE = 79;

export const sampleShippingFor = (subtotal: number) =>
  subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;

export function shippingStatus(subtotal: number, confirmed: boolean = SHIPPING_RATES_CONFIRMED): ShippingStatus {
  if (!confirmed) return { state: "pending" };
  const fee = sampleShippingFor(subtotal);
  return fee === 0 ? { state: "free" } : { state: "charged", amount: fee };
}

/** Clamp a requested quantity to 1…MAX_QTY_PER_LINE. */
export const clampQty = (n: number) => Math.max(1, Math.min(MAX_QTY_PER_LINE, Math.floor(Number.isFinite(n) ? n : 1)));

/** How many more units can go into a line that already holds `inBag`. */
export const roomLeft = (inBag: number) => Math.max(0, MAX_QTY_PER_LINE - inBag);

export const lineTotal = (price: number, quantity: number) => Math.round(price * quantity);

export interface PriceLine {
  price: number;
  quantity: number;
}

/**
 * Bag / order totals. `total` stays null until every amount (shipping included)
 * is known, so no screen can show a payable figure that hasn't been confirmed.
 */
export function summarize(
  lines: PriceLine[],
  opts: { shippingConfirmed?: boolean; discount?: number } = {},
): OrderSummary {
  const subtotal = lines.reduce((s, l) => s + lineTotal(l.price, l.quantity), 0);
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);
  const discount = Math.min(subtotal, Math.max(0, opts.discount ?? 0));
  const shipping = shippingStatus(subtotal - discount, opts.shippingConfirmed ?? SHIPPING_RATES_CONFIRMED);
  const total =
    shipping.state === "pending" ? null : subtotal - discount + (shipping.state === "charged" ? shipping.amount : 0);
  return { subtotal, discount, shipping, total, itemCount };
}
