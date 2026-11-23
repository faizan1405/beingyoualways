// Temporary checkout draft. Customer contact and delivery details are personal
// data, so they live in sessionStorage only (this browser tab, cleared when the
// tab closes or checkout finishes) — never localStorage, never payment details.
import { emptyCheckout, type CheckoutForm } from "@/lib/checkout-validation";
import type { PaymentMethod } from "@/lib/types";

export const CHECKOUT_DRAFT_KEY = "bya.checkout.draft.v1";

export interface CheckoutDraft {
  form: CheckoutForm;
  pay: PaymentMethod | null;
}

const FORM_KEYS = Object.keys(emptyCheckout) as (keyof CheckoutForm)[];

const session = (): Storage | null => {
  try { return typeof window === "undefined" ? null : window.sessionStorage; } catch { return null; }
};

/** Remove any copy an older build may have left in permanent storage. */
const purgeLegacy = () => {
  try { if (typeof window !== "undefined") window.localStorage.removeItem(CHECKOUT_DRAFT_KEY); } catch { /* ignore */ }
};

export function loadCheckoutDraft(): CheckoutDraft | null {
  purgeLegacy();
  try {
    const d = JSON.parse(session()?.getItem(CHECKOUT_DRAFT_KEY) ?? "null");
    if (!d || typeof d !== "object") return null;
    const form = { ...emptyCheckout };
    for (const k of FORM_KEYS) if (typeof d.form?.[k] === "string") (form as Record<string, string>)[k] = d.form[k];
    if (!["home", "work", "other"].includes(form.addressType)) form.addressType = "home";
    const pay = d.pay === "razorpay" || d.pay === "cod" ? d.pay : null;
    return { form, pay };
  } catch { return null; }
}

/** Saves only the known address/contact fields and the payment choice — nothing else. */
export function saveCheckoutDraft(form: CheckoutForm, pay: PaymentMethod | null) {
  const s = session();
  if (!s) return;
  const isEmpty = FORM_KEYS.every((k) => form[k] === emptyCheckout[k]) && !pay;
  if (isEmpty) { s.removeItem(CHECKOUT_DRAFT_KEY); return; }
  const clean: Record<string, string> = {};
  for (const k of FORM_KEYS) clean[k] = form[k];
  s.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify({ form: clean, pay }));
}

export function clearCheckoutDraft() {
  session()?.removeItem(CHECKOUT_DRAFT_KEY);
  purgeLegacy();
}

// One random id per checkout attempt. The server uses it so a double-click, a refresh or a retry
// after a dropped connection returns the SAME order instead of creating a second one.
const KEY_KEY = "bya.checkout.key.v1";
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16)));
export function currentCheckoutKey(): string {
  const s = session();
  const existing = s?.getItem(KEY_KEY);
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  const k = newKey();
  s?.setItem(KEY_KEY, k);
  return k;
}
/** Start a fresh checkout attempt (after an order is placed, or when the bag changed since the last attempt). */
export function resetCheckoutKey(): string {
  session()?.removeItem(KEY_KEY);
  return currentCheckoutKey();
}
