import { CreditCard, Info, Wallet } from "lucide-react";

import { inrPaise } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

export type { PaymentMethod };

export const paymentOptions: { v: PaymentMethod; I: typeof CreditCard; t: string; d: string; note: string }[] = [
  { v: "razorpay", I: CreditCard, t: "Pay online · Razorpay", d: "UPI, cards, netbanking and wallets in the secure Razorpay window.", note: "Not connected in this preview — no payment can be taken here." },
  { v: "cod", I: Wallet, t: "Cash on Delivery", d: "Pay in cash when your order arrives.", note: "Not connected in this preview — no order can be placed here." },
];

/** What the store server says is available for this bag and address (live shop only). */
export type LiveMethods = {
  cod: { available: boolean; feePaise: number | null; reason: string | null };
  razorpay: { available: boolean; testMode: boolean; reason: string | null };
} | "loading";

const liveNote = (v: PaymentMethod, live: Exclude<LiveMethods, "loading">) =>
  v === "cod"
    ? live.cod.available ? (live.cod.feePaise ? `COD charge ${inrPaise(live.cod.feePaise)} is added to the total.` : "No extra charge for Cash on Delivery.") : live.cod.reason ?? "Not available for this order."
    : live.razorpay.available ? (live.razorpay.testMode ? "TEST MODE — the store is testing payments; no real money is taken." : "Your payment is verified by our server before the order is confirmed.") : live.razorpay.reason ?? "Not available right now.";

export const paymentLabel = (m: PaymentMethod) => paymentOptions.find((o) => o.v === m)?.t ?? m;

/** Reusable payment selector. Wire `onChange` to Razorpay / backend order creation once available. */
export function PaymentMethods({ value, onChange, error, live }: { value: PaymentMethod | null; onChange: (v: PaymentMethod) => void; error?: string | undefined; live?: LiveMethods | undefined }) {
  return (
    <div role="radiogroup" aria-label="Payment method" aria-invalid={!!error} aria-describedby={error ? "payment-err" : undefined} className="grid gap-3" id="payment">
      {paymentOptions.map(({ v, I, t, d, note: previewNote }) => {
        const on = value === v;
        const unavailable = live && live !== "loading" && !(v === "cod" ? live.cod.available : live.razorpay.available);
        const note = !live ? previewNote : live === "loading" ? "Checking availability…" : liveNote(v, live);
        return (
          <button type="button" role="radio" aria-checked={on} aria-disabled={unavailable || undefined} key={v} onClick={() => { if (!unavailable) onChange(v); }}
            className={cn("press group flex gap-4 rounded-xl border bg-card p-5 text-left transition-all duration-300", unavailable && "cursor-not-allowed opacity-60", on ? "border-primary bg-primary/5 ring-1 ring-primary" : error ? "border-destructive/60" : "border-input hover:border-primary/50")}>
            <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors", on ? "border-primary" : "border-input")}>
              <span className={cn("size-2.5 rounded-full bg-primary transition-transform duration-300", on ? "scale-100" : "scale-0")} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-semibold"><I className="size-4 shrink-0 text-primary" /> {t}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{d}</span>
              <span className="mt-2 flex items-start gap-1.5 text-[11px] font-medium text-muted-foreground"><Info className="mt-px size-3 shrink-0 text-accent" /> {note}</span>
            </span>
          </button>
        );
      })}
      {error && <p id="payment-err" role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
