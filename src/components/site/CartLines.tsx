import { Link } from "@tanstack/react-router";
import { Minus, Plus, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { ProductVisual } from "@/components/shop/ProductVisual";
import { inr } from "@/lib/format";
import { useShop } from "@/lib/shop-store";

export function QtyStepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="inline-flex h-9 items-center rounded-full border border-input">
      <button type="button" className="press grid size-9 place-items-center rounded-full hover:bg-secondary" aria-label={`Decrease ${label} quantity`} onClick={() => onChange(value - 1)}><Minus className="size-3.5" /></button>
      <span className="relative w-6 overflow-hidden text-center text-sm tabular-nums" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={value} className="block" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.18 }}>{value}</motion.span>
        </AnimatePresence>
      </span>
      <button type="button" className="press grid size-9 place-items-center rounded-full hover:bg-secondary" aria-label={`Increase ${label} quantity`} onClick={() => onChange(value + 1)} disabled={value >= 10}><Plus className="size-3.5" /></button>
    </div>
  );
}

export function CartLines({ compact = false }: { compact?: boolean | undefined}) {
  const { lines, setQty, remove, setDrawerOpen } = useShop();
  const reduce = useReducedMotion();
  return (
    <ul className="divide-y divide-border">
      <AnimatePresence initial={false}>
      {lines.map((l) => (
        <motion.li
          key={l.variantId}
          layout={!reduce}
          initial={reduce ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, x: 40, height: 0, paddingTop: 0, paddingBottom: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex gap-4 overflow-hidden py-5"
        >
          <Link to="/product/$slug" params={{ slug: l.product.slug }} onClick={() => setDrawerOpen(false)} className={compact ? "w-20 shrink-0" : "w-24 shrink-0 md:w-28"}>
            <ProductVisual shape={l.product.shape} tint={l.product.tint} label={l.product.name} className="rounded-md" tag={false} />
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
              <motion.span key={l.lineTotal} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className="text-sm font-semibold tabular-nums">{inr(l.lineTotal)}</motion.span>
            </div>
          </div>
        </motion.li>
      ))}
      </AnimatePresence>
    </ul>
  );
}
