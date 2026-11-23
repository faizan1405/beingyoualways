import { Link } from "@tanstack/react-router";

import { inrPaise } from "@/lib/format";
import { useShop } from "@/lib/shop-store";
import type { OrderSummary } from "@/lib/types";

// Rupee amounts may carry paise (e.g. a 12.5 % discount), so show them exactly.
const inrExact = (rupees: number) => inrPaise(Math.round(rupees * 100));

/** Totals block shared by bag, drawer and checkout. Reads amounts from the central pricing summary. */
export function OrderTotals({ summary: given }: { summary?: OrderSummary | undefined }) {
  const { summary: fromBag } = useShop();
  const s = given ?? fromBag;
  return (
    <dl className="space-y-3 text-sm">
      <div className="flex justify-between gap-4"><dt>Subtotal <span className="text-muted-foreground">({s.itemCount} {s.itemCount === 1 ? "item" : "items"})</span></dt><dd className="tabular-nums">{inrExact(s.subtotal)}</dd></div>
      {s.discount > 0 && <div className="flex justify-between gap-4"><dt>Discount</dt><dd className="tabular-nums">−{inrExact(s.discount)}</dd></div>}
      <div className="flex justify-between gap-4">
        <dt>Shipping</dt>
        <dd className="text-right">{s.shipping.state === "pending" ? <span className="text-muted-foreground">Pending confirmation</span> : s.shipping.state === "free" ? "Free" : inrExact(s.shipping.amount)}</dd>
      </div>
      {s.codFee != null && s.codFee > 0 && <div className="flex justify-between gap-4"><dt>Cash on Delivery charge</dt><dd className="tabular-nums">{inrExact(s.codFee)}</dd></div>}
      <div className="flex justify-between gap-4 border-t border-border pt-3 text-base font-semibold">
        <dt>Total payable</dt>
        <dd className="text-right tabular-nums">{s.total == null ? <span className="text-sm font-normal text-muted-foreground">Confirmed with shipping</span> : inrExact(s.total)}</dd>
      </div>
      {s.shipping.state === "pending" && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Shipping charges are pending confirmation by Being You, so the final payable amount isn't shown yet. See our <Link to="/shipping-policy" className="underline">Shipping Policy</Link>.
        </p>
      )}
    </dl>
  );
}
