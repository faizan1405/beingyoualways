import { CreditCard, Info, Wallet } from "lucide-react";

import { cn } from "@/lib/utils";

export type PaymentMethod = "razorpay" | "cod";

const options: { v: PaymentMethod; I: typeof CreditCard; t: string; d: string; note: string }[] = [
  { v: "razorpay", I: CreditCard, t: "Pay online · Razorpay", d: "UPI, cards, netbanking and wallets via Razorpay's secure checkout.", note: "Integration required — no payment can be taken yet." },
  { v: "cod", I: Wallet, t: "Cash on Delivery", d: "Pay in cash when your order arrives.", note: "COD availability and any charges are still to be confirmed by Being You." },
];

/** Reusable payment selector. Wire `onChange` to Razorpay / backend order creation once available. */
export function PaymentMethods({ value, onChange }: { value: PaymentMethod; onChange: (v: PaymentMethod) => void }) {
  return (
    <div role="radiogroup" aria-label="Payment method" className="grid gap-3">
      {options.map(({ v, I, t, d, note }) => {
        const on = value === v;
        return (
          <button type="button" role="radio" aria-checked={on} key={v} onClick={() => onChange(v)}
            className={cn("press group flex gap-4 rounded-xl border p-5 text-left transition-all duration-300", on ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-input hover:border-primary/50")}>
            <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors", on ? "border-primary" : "border-input")}>
              <span className={cn("size-2.5 rounded-full bg-primary transition-transform duration-300", on ? "scale-100" : "scale-0")} />
            </span>
            <span className="flex-1">
              <span className="flex items-center gap-2 text-sm font-semibold"><I className="size-4 text-primary" /> {t}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{d}</span>
              <span className="mt-2 flex items-start gap-1.5 text-[11px] font-medium text-muted-foreground"><Info className="mt-px size-3 shrink-0 text-accent" /> {note}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
