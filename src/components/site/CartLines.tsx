import { Link } from "@tanstack/react-router";
import { Minus, Plus, X } from "lucide-react";

import { ProductVisual } from "@/components/shop/ProductVisual";
import { inr } from "@/lib/format";
import { useShop } from "@/lib/shop-store";

export function QtyStepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="inline-flex h-9 items-center rounded-full border border-input">
      <button type="button" className="grid size-9 place-items-center" aria-label={`Decrease ${label} quantity`} onClick={() => onChange(value - 1)}><Minus className="size-3.5" /></button>
      <span className="w-6 text-center text-sm tabular-nums" aria-live="polite">{value}</span>
      <button type="button" className="grid size-9 place-items-center" aria-label={`Increase ${label} quantity`} onClick={() => onChange(value + 1)} disabled={value >= 10}><Plus className="size-3.5" /></button>
    </div>
  );
}

export function CartLines({ compact = false }: { compact?: boolean }) {
  const { lines, setQty, remove, setDrawerOpen } = useShop();
  return (
    <ul className="divide-y divide-border">
      {lines.map((l) => (
        <li key={l.variantId} className="flex gap-4 py-5">
          <Link to="/product/$slug" params={{ slug: l.product.slug }} onClick={() => setDrawerOpen(false)} className={compact ? "w-20 shrink-0" : "w-24 shrink-0 md:w-28"}>
            <ProductVisual shape={l.product.shape} tint={l.product.tint} label={l.product.name} className="rounded-md" />
          </Link>
          <div className="flex flex-1 flex-col">
            <div className="flex justify-between gap-2">
              <div>
                <p className="font-serif text-lg leading-tight">{l.product.name}</p>
                <p className="text-xs text-muted-foreground">{l.variant.kind === "shade" ? "Shade" : "Size"}: {l.variant.label}</p>
              </div>
              <button aria-label={`Remove ${l.product.name}`} onClick={() => remove(l.productId, l.variantId)} className="self-start text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
            </div>
            <div className="mt-auto flex items-center justify-between pt-3">
              <QtyStepper value={l.quantity} label={l.product.name} onChange={(n) => setQty(l.productId, l.variantId, n)} />
              <span className="text-sm font-semibold">{inr(l.lineTotal)}</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
