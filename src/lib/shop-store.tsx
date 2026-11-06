import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { cartService, shippingFor } from "@/services/cartService";
import { productService } from "@/services/productService";
import type { CartItem, Product, ProductVariant } from "@/lib/types";

export interface CartLine extends CartItem {
  product: Product;
  variant: ProductVariant;
  lineTotal: number;
}

interface ShopState {
  items: CartItem[];
  lines: CartLine[];
  count: number;
  subtotal: number;
  shipping: number;
  total: number;
  add: (productId: string, variantId: string, qty?: number) => void;
  setQty: (productId: string, variantId: string, qty: number) => void;
  remove: (productId: string, variantId: string) => void;
  clear: () => void;
  wishlist: string[];
  toggleWish: (productId: string) => void;
  isWished: (productId: string) => boolean;
  drawerOpen: boolean;
  setDrawerOpen: (o: boolean) => void;
}

const Ctx = createContext<ShopState | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setItems(cartService.loadCart());
    setWishlist(cartService.loadWishlist());
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) cartService.saveCart(items); }, [items, hydrated]);
  useEffect(() => { if (hydrated) cartService.saveWishlist(wishlist); }, [wishlist, hydrated]);

  const lines = useMemo<CartLine[]>(() => {
    const all = productService.peekAll();
    return items.flatMap((i) => {
      const product = all.find((p) => p.id === i.productId);
      const variant = product?.variants.find((v) => v.id === i.variantId);
      return product && variant ? [{ ...i, product, variant, lineTotal: variant.price * i.quantity }] : [];
    });
  }, [items]);

  const add = useCallback((productId: string, variantId: string, qty = 1) => {
    setItems((prev) => {
      const ex = prev.find((i) => i.productId === productId && i.variantId === variantId);
      return ex
        ? prev.map((i) => (i === ex ? { ...i, quantity: Math.min(10, i.quantity + qty) } : i))
        : [...prev, { productId, variantId, quantity: qty }];
    });
    setDrawerOpen(true);
  }, []);
  const setQty = useCallback((productId: string, variantId: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => !(i.productId === productId && i.variantId === variantId))
        : prev.map((i) => (i.productId === productId && i.variantId === variantId ? { ...i, quantity: Math.min(10, qty) } : i)),
    );
  }, []);
  const remove = useCallback((productId: string, variantId: string) => setQty(productId, variantId, 0), [setQty]);
  const toggleWish = useCallback((id: string) => {
    setWishlist((prev) => {
      const has = prev.includes(id);
      toast(has ? "Removed from wishlist" : "Saved to wishlist");
      return has ? prev.filter((x) => x !== id) : [...prev, id];
    });
  }, []);

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const shipping = shippingFor(subtotal);
  const value: ShopState = {
    items, lines, subtotal, shipping, total: subtotal + shipping,
    count: lines.reduce((s, l) => s + l.quantity, 0),
    add, setQty, remove, clear: () => setItems([]),
    wishlist, toggleWish, isWished: (id) => wishlist.includes(id),
    drawerOpen, setDrawerOpen,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShop() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useShop must be used inside ShopProvider");
  return c;
}
