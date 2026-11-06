import { Link, createFileRoute } from "@tanstack/react-router";
import { CreditCard, Wallet, CheckCircle2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { DemoNotice } from "@/components/shop/DemoNotice";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/format";
import { useShop } from "@/lib/shop-store";
import { INDIAN_STATES, validateCheckout, type CheckoutErrors, type CheckoutForm } from "@/lib/checkout-validation";
import { cn } from "@/lib/utils";
import { OrderTotals } from "./_site.cart";

export const Route = createFileRoute("/_site/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout | Being You – Always" },
      { name: "description", content: "Complete your Being You – Always order (demo checkout)." },
      { property: "og:title", content: "Checkout | Being You – Always" },
      { property: "og:description", content: "Demo checkout." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkout,
});

const empty: CheckoutForm = { name: "", phone: "", email: "", address: "", city: "", state: "", pincode: "" };

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
      {error && <p id={`${id}-err`} className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}

const inputCls = (err?: string) => cn("h-12 w-full rounded-md border bg-card px-4 text-sm outline-none focus:border-primary", err ? "border-destructive" : "border-input");

function Checkout() {
  const { lines } = useShop();
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [pay, setPay] = useState<"razorpay" | "cod">("razorpay");
  const [code, setCode] = useState("");
  const [reviewed, setReviewed] = useState(false);

  const set = (k: keyof CheckoutForm) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const inp = (k: keyof CheckoutForm, props: Record<string, unknown> = {}) => (
    <input id={k} value={f[k]} onChange={set(k)} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `${k}-err` : undefined} className={inputCls(errors[k])} {...props} />
  );

  if (lines.length === 0 && !reviewed)
    return (
      <div className="container-lux py-28 text-center">
        <h1 className="text-5xl">Your bag is empty</h1>
        <Button variant="lux" size="xl" className="mt-8" asChild><Link to="/shop">Shop the collection</Link></Button>
      </div>
    );

  if (reviewed)
    return (
      <div className="container-lux max-w-xl py-24 text-center">
        <CheckCircle2 className="mx-auto size-12 text-success" strokeWidth={1.3} />
        <h1 className="mt-6 text-4xl">Checkout details look good</h1>
        <p className="mt-4 text-muted-foreground">This is a <strong>demo checkout</strong>. No payment was taken and <strong>no order has been placed</strong>. Live ordering will be enabled once Razorpay and the store backend are connected.</p>
        <Button variant="lux" size="xl" className="mt-8" asChild><Link to="/shop">Continue browsing</Link></Button>
      </div>
    );

  return (
    <div className="container-lux py-12">
      <h1 className="text-5xl">Checkout</h1>
      <DemoNotice className="mt-6">Demo checkout — integration required. Payments and orders are not processed in this prototype.</DemoNotice>
      <form
        noValidate
        className="mt-10 grid gap-12 lg:grid-cols-[1fr_400px]"
        onSubmit={(e) => {
          e.preventDefault();
          const errs = validateCheckout(f);
          setErrors(errs);
          if (Object.keys(errs).length) {
            toast.error("Please fix the highlighted fields");
            document.getElementById(Object.keys(errs)[0])?.focus();
            return;
          }
          setReviewed(true);
          window.scrollTo({ top: 0 });
        }}
      >
        <div className="space-y-10">
          <section className="space-y-4">
            <h2 className="text-2xl">Contact information</h2>
            <Field id="name" label="Full name" error={errors.name}>{inp("name", { autoComplete: "name" })}</Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="phone" label="Mobile number" error={errors.phone}>{inp("phone", { type: "tel", inputMode: "numeric", autoComplete: "tel", placeholder: "10-digit mobile" })}</Field>
              <Field id="email" label="Email" error={errors.email}>{inp("email", { type: "email", autoComplete: "email" })}</Field>
            </div>
          </section>
          <section className="space-y-4">
            <h2 className="text-2xl">Shipping address</h2>
            <Field id="address" label="Address" error={errors.address}>{inp("address", { autoComplete: "street-address", placeholder: "House no., street, area" })}</Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="city" label="City" error={errors.city}>{inp("city", { autoComplete: "address-level2" })}</Field>
              <Field id="state" label="State" error={errors.state}>
                <select id="state" value={f.state} onChange={set("state")} aria-invalid={!!errors.state} className={inputCls(errors.state)}>
                  <option value="">Select</option>
                  {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field id="pincode" label="PIN code" error={errors.pincode}>{inp("pincode", { inputMode: "numeric", maxLength: 6, autoComplete: "postal-code" })}</Field>
            </div>
          </section>
          <section className="space-y-4">
            <h2 className="text-2xl">Payment method</h2>
            <div role="radiogroup" className="grid gap-3">
              {[
                { v: "razorpay" as const, I: CreditCard, t: "Pay online · Razorpay", d: "UPI, cards, netbanking — integration pending" },
                { v: "cod" as const, I: Wallet, t: "Cash on Delivery", d: "Availability by PIN code — integration pending" },
              ].map(({ v, I, t, d }) => (
                <button type="button" role="radio" aria-checked={pay === v} key={v} onClick={() => setPay(v)} className={cn("flex items-center gap-4 rounded-lg border p-4 text-left transition", pay === v ? "border-primary ring-1 ring-primary bg-primary/5" : "border-input")}>
                  <I className="size-5 text-primary" />
                  <span><span className="block text-sm font-semibold">{t}</span><span className="text-xs text-muted-foreground">{d}</span></span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-xl bg-secondary p-6 lg:sticky lg:top-24">
          <h2 className="text-2xl">Order summary</h2>
          <ul className="my-5 space-y-3 text-sm">
            {lines.map((l) => (
              <li key={l.variantId} className="flex justify-between gap-3"><span>{l.product.name} <span className="text-muted-foreground">· {l.variant.label} × {l.quantity}</span></span><span>{inr(l.lineTotal)}</span></li>
            ))}
          </ul>
          <div className="mb-5 flex gap-2">
            <label htmlFor="code" className="sr-only">Discount code</label>
            <input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Discount code" className="h-11 flex-1 rounded-md border border-input bg-card px-3 text-sm" />
            <Button type="button" variant="outline" className="h-11" onClick={() => toast("Discount codes will work once the backend is connected.")}>Apply</Button>
          </div>
          <OrderTotals />
          <Button type="submit" variant="lux" size="xl" className="mt-6 w-full">Review order (demo)</Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">No payment will be taken.</p>
        </aside>
      </form>
    </div>
  );
}
