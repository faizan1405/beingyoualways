import { Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";

import { ProductVisual } from "@/components/shop/ProductVisual";
import { inr } from "@/lib/format";
import { MAX_QTY_PER_LINE } from "@/lib/pricing";
import { useShop, type CartLine } from "@/lib/shop-store";
import { variantText } from "@/lib/variants";
import { cn } from "@/lib/utils";

export function QtyStepper({ value, onChange, label, min = 1, max = MAX_QTY_PER_LINE, size = "md" }: {
  value: number; onChange: (n: number) => void; label: string; min?: number | undefined; max?: number | undefined; size?: "md" | "lg" | undefined;
}) {
  const btn = size === "lg" ? "size-11" : "size-9";
  return (
    <div className={cn("inline-flex shrink-0 items-center rounded-full border border-input bg-card", size === "lg" ? "h-11" : "h-9")} role="group" aria-label={`${label} quantity`}>
      <button type="button" className={cn("press grid place-items-center rounded-full hover:bg-secondary disabled:opacity-40", btn)} aria-label={`Decrease ${label} quantity`} onClick={() => onChange(value - 1)} disabled={value <= min}><Minus className="size-3.5" /></button>
      <span className="relative w-7 overflow-hidden text-center text-sm tabular-nums" aria-live="polite" aria-label={`Quantity ${value}`}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={value} className="block" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.18 }}>{value}</motion.span>
        </AnimatePresence>
      </span>
      <button type="button" className={cn("press grid place-items-center rounded-full hover:bg-secondary disabled:opacity-40", btn)} aria-label={`Increase ${label} quantity`} onClick={() => onChange(value + 1)} disabled={value >= max}><Plus className="size-3.5" /></button>
    </div>
  );
}

export function CartLines({ compact = false }: { compact?: boolean | undefined }) {
  const { lines, setQty, remove, add, setDrawerOpen } = useShop();
  const reduce = useReducedMotion();

  const removeLine = (l: CartLine) => {
    remove(l.productId, l.variantId);
    toast(`Removed ${l.product.name}`, {
      action: { label: "Undo", onClick: () => add(l.productId, l.variantId, l.quantity, { openDrawer: false }) },
    });
  };

  return (
    <ul className="divide-y divide-border">
      <AnimatePresence initial={false}>
        {lines.map((l) => {
          const vt = variantText(l.variant);
          return (
            <motion.li
              key={`${l.productId}:${l.variantId}`}
              layout={!reduce}
              initial={reduce ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: 40, height: 0, paddingTop: 0, paddingBottom: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex gap-4 overflow-hidden py-5"
            >
              <Link to="/product/$slug" params={{ slug: l.product.slug }} onClick={() => setDrawerOpen(false)} className={cn("shrink-0 overflow-hidden rounded-md", compact ? "w-20" : "w-24 md:w-32")}>
                <ProductVisual src={l.product.images?.[0]} shape={l.product.shape} tint={l.product.tint} label={l.product.name} tag={false} />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <Link to="/product/$slug" params={{ slug: l.product.slug }} onClick={() => setDrawerOpen(false)} className={cn("font-serif leading-tight hover:text-primary", compact ? "text-lg" : "text-lg md:text-xl")}>{l.product.name}</Link>
                    {vt && <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">{l.variant.swatch && <span className="size-3 rounded-full border border-border" style={{ background: l.variant.swatch }} aria-hidden />}{vt}</p>}
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{inr(l.variant.price)} each</p>
                  </div>
                  {compact && (
                    <button type="button" aria-label={`Remove ${l.product.name}`} onClick={() => removeLine(l)} className="press grid size-9 shrink-0 place-items-center self-start rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"><X className="size-4" /></button>
                  )}
                </div>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-3">
                  <div className="flex items-center gap-3">
                    <QtyStepper value={l.quantity} label={l.product.name} onChange={(n) => setQty(l.productId, l.variantId, n)} />
                    {!compact && (
                      <button type="button" onClick={() => removeLine(l)} className="press inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" aria-label={`Remove ${l.product.name}`}>
                        <Trash2 className="size-3.5" /> Remove
                      </button>
                    )}
                  </div>
                  <motion.span key={l.lineTotal} initial={{ opacity: 0.3, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="text-sm font-semibold tabular-nums">{inr(l.lineTotal)}</motion.span>
                </div>
                {l.quantity >= MAX_QTY_PER_LINE && <p className="mt-1.5 text-[11px] text-muted-foreground">Maximum {MAX_QTY_PER_LINE} per item.</p>}
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
