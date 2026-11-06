// Cart & wishlist persistence. Uses localStorage for this frontend prototype
// only; the real cart will be stored by the backend.
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

export const FREE_SHIPPING_THRESHOLD = 999;
export const SHIPPING_FEE = 79;
export const shippingFor = (subtotal: number) => (subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE);

export const cartService = {
  loadCart: () => read<CartItem[]>(CART_KEY, []),
  saveCart: (items: CartItem[]) => localStorage.setItem(CART_KEY, JSON.stringify(items)),
  loadWishlist: () => read<string[]>(WISH_KEY, []),
  saveWishlist: (ids: string[]) => localStorage.setItem(WISH_KEY, JSON.stringify(ids)),
};
