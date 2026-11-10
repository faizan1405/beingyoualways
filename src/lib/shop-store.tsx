import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { cartService } from "@/services/cartService";
import { productService } from "@/services/productService";
import { clampQty, lineTotal, qtyLimitText, roomLeft, summarize } from "@/lib/pricing";
import type { CartItem, OrderSummary, Product, ProductVariant } from "@/lib/types";

export interface CartLine extends CartItem {
  product: Product;
  variant: ProductVariant;
  lineTotal: number;
}

export type AddResult =
  | { ok: true; added: number; capped: boolean }
  | { ok: false; reason: "unavailable" | "full" | "unknown" };

interface ShopState {
  items: CartItem[];
  lines: CartLine[];
  count: number;
  subtotal: number;
  summary: OrderSummary;
  /** Units of this variant already in the bag. */
  qtyInBag: (productId: string, variantId: string) => number;
  add: (productId: string, variantId: string, qty?: number, opts?: { openDrawer?: boolean }) => AddResult;
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
  const itemsRef = useRef(items);
  itemsRef.current = items;

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
      return product && variant ? [{ ...i, product, variant, lineTotal: lineTotal(variant.price, i.quantity) }] : [];
    });
  }, [items]);

  const qtyInBag = useCallback(
    (productId: string, variantId: string) =>
      itemsRef.current.find((i) => i.productId === productId && i.variantId === variantId)?.quantity ?? 0,
    [],
  );

  const add = useCallback((productId: string, variantId: string, qty = 1, opts: { openDrawer?: boolean } = {}): AddResult => {
    const variant = productService.peekAll().find((p) => p.id === productId)?.variants.find((v) => v.id === variantId);
    if (!variant) return { ok: false, reason: "unknown" };
    if (variant.stock <= 0) return { ok: false, reason: "unavailable" };
    const current = itemsRef.current.find((i) => i.productId === productId && i.variantId === variantId)?.quantity ?? 0;
    const wanted = clampQty(qty);
    const added = Math.min(wanted, roomLeft(current));
    if (added === 0) {
      toast(qtyLimitText.full);
      return { ok: false, reason: "full" };
    }
    const next = current
      ? itemsRef.current.map((i) => (i.productId === productId && i.variantId === variantId ? { ...i, quantity: current + added } : i))
      : [...itemsRef.current, { productId, variantId, quantity: added }];
    itemsRef.current = next;
    setItems(next);
    if (added < wanted) toast(qtyLimitText.capped(added));
    if (opts.openDrawer !== false) setDrawerOpen(true);
    return { ok: true, added, capped: added < wanted };
  }, []);

  const setQty = useCallback((productId: string, variantId: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => !(i.productId === productId && i.variantId === variantId))
        : prev.map((i) => (i.productId === productId && i.variantId === variantId ? { ...i, quantity: clampQty(qty) } : i)),
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

  const summary = useMemo(() => summarize(lines.map((l) => ({ price: l.variant.price, quantity: l.quantity }))), [lines]);
  const value: ShopState = {
    items, lines, summary, subtotal: summary.subtotal,
    count: summary.itemCount,
    qtyInBag, add, setQty, remove, clear: () => setItems([]),
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
