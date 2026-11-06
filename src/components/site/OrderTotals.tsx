import { inr } from "@/lib/format";
import { useShop } from "@/lib/shop-store";

export function OrderTotals() {
  const { subtotal, shipping, total } = useShop();
  return (
    <dl className="space-y-3 text-sm">
      <div className="flex justify-between"><dt>Subtotal</dt><dd>{inr(subtotal)}</dd></div>
      <div className="flex justify-between"><dt>Shipping</dt><dd>{shipping === 0 ? "Free" : inr(shipping)}</dd></div>
      <div className="flex justify-between border-t border-border pt-3 text-base font-semibold"><dt>Total</dt><dd>{inr(total)}</dd></div>
    </dl>
  );
}
