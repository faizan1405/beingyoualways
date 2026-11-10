// Cart & wishlist persistence. Uses localStorage for this frontend prototype
// only; the real cart will be stored by the backend.
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE, sampleShippingFor, shippingStatus } from "@/lib/pricing";
import type { CartItem } from "@/lib/types";

const CART_KEY = "bya.cart.v1";
const WISH_KEY = "bya.wishlist.v1";

const read = <T,>(k: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(localStorage.getItem(k) ?? "") as T;
  } catch {
    return fallback;
  }
};

// Pricing rules live in src/lib/pricing.ts; re-exported for existing callers.
export { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE, sampleShippingFor };
/** Amount charged for shipping today (0 while rates are unconfirmed). */
export const shippingFor = (subtotal: number) => {
  const s = shippingStatus(subtotal);
  return s.state === "charged" ? s.amount : 0;
};

const isItem = (x: unknown): x is CartItem =>
  !!x && typeof x === "object" && typeof (x as CartItem).productId === "string" && typeof (x as CartItem).variantId === "string" && Number.isFinite((x as CartItem).quantity);

export const cartService = {
  loadCart: () => {
    const v = read<unknown>(CART_KEY, []);
    return Array.isArray(v) ? v.filter(isItem) : [];
  },
  saveCart: (items: CartItem[]) => localStorage.setItem(CART_KEY, JSON.stringify(items)),
  loadWishlist: () => {
    const v = read<unknown>(WISH_KEY, []);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  },
  saveWishlist: (ids: string[]) => localStorage.setItem(WISH_KEY, JSON.stringify(ids)),
};
