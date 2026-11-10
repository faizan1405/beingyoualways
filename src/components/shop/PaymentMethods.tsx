import { CreditCard, Info, Wallet } from "lucide-react";

import type { PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

export type { PaymentMethod };

export const paymentOptions: { v: PaymentMethod; I: typeof CreditCard; t: string; d: string; note: string }[] = [
  { v: "razorpay", I: CreditCard, t: "Pay online · Razorpay", d: "For future online payment by UPI, cards, netbanking and wallets through Razorpay.", note: "Not connected yet — no payment can be taken in this prototype." },
  { v: "cod", I: Wallet, t: "Cash on Delivery", d: "For future orders paid in cash when they arrive.", note: "COD availability, restrictions and any charges are pending client approval." },
];

export const paymentLabel = (m: PaymentMethod) => paymentOptions.find((o) => o.v === m)?.t ?? m;

/** Reusable payment selector. Wire `onChange` to Razorpay / backend order creation once available. */
export function PaymentMethods({ value, onChange, error }: { value: PaymentMethod | null; onChange: (v: PaymentMethod) => void; error?: string | undefined }) {
  return (
    <div role="radiogroup" aria-label="Payment method" aria-invalid={!!error} aria-describedby={error ? "payment-err" : undefined} className="grid gap-3" id="payment">
      {paymentOptions.map(({ v, I, t, d, note }) => {
        const on = value === v;
        return (
          <button type="button" role="radio" aria-checked={on} key={v} onClick={() => onChange(v)}
            className={cn("press group flex gap-4 rounded-xl border bg-card p-5 text-left transition-all duration-300", on ? "border-primary bg-primary/5 ring-1 ring-primary" : error ? "border-destructive/60" : "border-input hover:border-primary/50")}>
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
