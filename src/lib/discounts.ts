// Discount rules for the admin calculation preview. Live checkout validation will
// run on the Hostinger backend; checkout does not apply codes in this prototype.
import type { Discount } from "@/lib/types";

export type DiscountCheck = { ok: true; amount: number } | { ok: false; amount: 0; reason: string };

const CODE_RE = /^[A-Z0-9]{3,20}$/;

/** Form validation — returns a list of problems (empty = valid). */
export function validateDiscount(d: Discount, others: Discount[] = []): string[] {
  const e: string[] = [];
  if (!CODE_RE.test(d.code)) e.push("Code must be 3–20 capital letters or numbers, no spaces.");
  if (others.some((o) => o.id !== d.id && o.code === d.code)) e.push("Another discount already uses this code.");
  if (!(d.value > 0)) e.push("Discount value must be more than 0.");
  if (d.type === "percent" && d.value > 100) e.push("A percentage discount can't be more than 100%.");
  if (d.minOrder != null && d.minOrder < 0) e.push("Minimum order can't be negative.");
  if (d.maxDiscount != null && !(d.maxDiscount > 0)) e.push("Maximum discount must be more than 0, or left blank.");
  if (d.usageLimit != null && !(d.usageLimit >= 1 && Number.isInteger(d.usageLimit))) e.push("Usage limit must be a whole number of 1 or more, or left blank.");
  if (d.startsAt && d.endsAt && new Date(d.endsAt) < new Date(d.startsAt)) e.push("Expiry date must be after the start date.");
  return e;
}

/** Would this code apply to a bag of `subtotal` at time `now`, and for how much? */
export function evaluateDiscount(d: Discount, subtotal: number, now: Date = new Date()): DiscountCheck {
  const no = (reason: string): DiscountCheck => ({ ok: false, amount: 0, reason });
  if (!d.active) return no("This code is switched off.");
  if (d.startsAt && now < new Date(d.startsAt)) return no("This code hasn't started yet.");
  if (d.endsAt && now > new Date(`${d.endsAt.length <= 10 ? `${d.endsAt}T23:59:59` : d.endsAt}`)) return no("This code has expired.");
  if (d.usageLimit != null && d.used >= d.usageLimit) return no("This code has reached its usage limit.");
  if (subtotal <= 0) return no("The bag is empty.");
  if (d.minOrder != null && subtotal < d.minOrder) return no(`Needs a minimum order of ₹${d.minOrder}.`);
  let amount = d.type === "percent" ? Math.round((subtotal * d.value) / 100) : d.value;
  if (d.maxDiscount != null) amount = Math.min(amount, d.maxDiscount);
  amount = Math.min(amount, subtotal);
  return { ok: true, amount };
}
