// Central pricing rules for the storefront. Every bag, drawer, checkout and
// review screen reads totals from here — never calculate prices in components.
import { SHIPPING_RATES_CONFIRMED } from "@/config/business";
import type { OrderSummary, ShippingStatus } from "@/lib/types";

/**
 * DEMO purchase limit: the most units of one product (shade/size) a single bag
 * can hold. This is a shopping-bag safety cap, NOT stock or inventory — it must
 * never be shown as "only N left". Change this one number to adjust it; replace
 * it with a value from the Hostinger inventory API once real stock is connected.
 */
export const DEMO_QTY_LIMIT_PER_ITEM = 10;
export const MAX_QTY_PER_LINE = DEMO_QTY_LIMIT_PER_ITEM;

/** Shopper-facing wording for the limit — phrased as an order rule, never as stock. */
export const qtyLimitText = {
  full: `You can add up to ${MAX_QTY_PER_LINE} of each item per order, and you already have ${MAX_QTY_PER_LINE} in your bag.`,
  capped: (added: number) => `Added ${added} — you can add up to ${MAX_QTY_PER_LINE} of each item per order.`,
  inBag: (n: number) => `${n} already in your bag${n >= MAX_QTY_PER_LINE ? ` — up to ${MAX_QTY_PER_LINE} of each item per order` : ""}.`,
};

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
