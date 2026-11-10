import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, Pencil, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { DemoNotice } from "@/components/shop/DemoNotice";
import { PaymentMethods, paymentLabel } from "@/components/shop/PaymentMethods";
import { ProductVisual } from "@/components/shop/ProductVisual";
import { OrderTotals } from "@/components/site/OrderTotals";
import { Button } from "@/components/ui/button";
import {
  CHECKOUT_STEPS, INDIAN_STATES, emptyCheckout, firstInvalidStep, normalisePhone, validateStep,
  type CheckoutErrors, type CheckoutForm, type CheckoutStep,
} from "@/lib/checkout-validation";
import { inr } from "@/lib/format";
import { useShop } from "@/lib/shop-store";
import type { AddressType, PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";
import { variantText } from "@/lib/variants";

export const Route = createFileRoute("/_site/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout | Being You – Always" },
      { name: "description", content: "Enter your contact, delivery and payment preferences for your Being You – Always order (demo checkout)." },
      { property: "og:title", content: "Checkout | Being You – Always" },
      { property: "og:description", content: "Demo checkout — no payment is taken and no order is placed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkout,
});

const DRAFT_KEY = "bya.checkout.draft.v1";

function Field({ id, label, error, hint, optional, children }: { id: string; label: string; error?: string | undefined; hint?: string | undefined; optional?: boolean; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>{optional && <span className="font-normal normal-case tracking-normal">Optional</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} role="alert" className="animate-in fade-in slide-in-from-top-1 mt-1.5 text-xs text-destructive duration-200">{error}</p>
      ) : hint ? <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const inputCls = (err?: string) =>
  cn("h-12 w-full scroll-mt-28 rounded-md border bg-card px-4 text-base outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_14%,transparent)] sm:text-sm", err ? "border-destructive" : "border-input");

const ADDRESS_TYPES: { v: AddressType; l: string }[] = [{ v: "home", l: "Home" }, { v: "work", l: "Work" }, { v: "other", l: "Other" }];

function Checkout() {
  const { lines, summary } = useShop();
  const [f, setF] = useState<CheckoutForm>(emptyCheckout);
  const [pay, setPay] = useState<PaymentMethod | null>(null);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [step, setStep] = useState<CheckoutStep>("contact");
  const [reached, setReached] = useState(0);
  const [done, setDone] = useState(false);
  const [code, setCode] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const loaded = useRef(false);

  // Keep entered details across reloads and step changes (this browser only).
  useEffect(() => {
    try {
      const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null");
      if (d?.form) setF({ ...emptyCheckout, ...d.form });
      if (d?.pay === "razorpay" || d?.pay === "cod") setPay(d.pay);
    } catch { /* ignore */ }
    loaded.current = true;
  }, []);
  useEffect(() => { if (loaded.current) sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ form: f, pay })); }, [f, pay]);

  const idx = CHECKOUT_STEPS.findIndex((s) => s.id === step);
  const goTo = (s: CheckoutStep) => {
    setStep(s);
    setReached((r) => Math.max(r, CHECKOUT_STEPS.findIndex((x) => x.id === s)));
    requestAnimationFrame(() => {
      headingRef.current?.focus({ preventScroll: true });
      headingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const set = (k: keyof CheckoutForm) => (e: { target: { value: string } }) => {
    setF((prev) => ({ ...prev, [k]: e.target.value }));
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: undefined }));
  };
  const inp = (k: keyof CheckoutForm, props: Record<string, unknown> = {}) => (
    <input id={k} name={k} value={f[k]} onChange={set(k)} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `${k}-err` : undefined} className={inputCls(errors[k])} enterKeyHint="next" {...props} />
  );

  const next = () => {
    const errs = validateStep(step, f, pay);
    setErrors(errs);
    const keys = Object.keys(errs);
    if (keys.length) {
      toast.error("Please check the highlighted details");
      document.getElementById(keys[0]!)?.focus();
      return;
    }
    const n = CHECKOUT_STEPS[idx + 1];
    if (n) goTo(n.id);
  };

  const submit = () => {
    const bad = firstInvalidStep(f, pay);
    if (bad) { setErrors(validateStep(bad, f, pay)); goTo(bad); toast.error("Some details need attention"); return; }
    setDone(true);
    window.scrollTo({ top: 0 });
  };

  if (done)
    return (
      <div className="container-lux max-w-xl py-24 text-center">
        <CheckCircle2 className="mx-auto size-12 text-success" strokeWidth={1.3} />
        <h1 className="mt-6 text-4xl">Your details are ready</h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          This is a <strong>demo checkout</strong>. You chose <strong>{pay ? paymentLabel(pay) : "—"}</strong>, but <strong>no payment was taken and no order has been placed</strong>. Live ordering will be switched on once Razorpay, Cash on Delivery rules, shipping charges and the store backend are confirmed and connected.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant="lux" size="xl" asChild><Link to="/shop">Continue browsing</Link></Button>
          <Button variant="luxOutline" size="xl" onClick={() => { setDone(false); setStep("review"); }}>Back to review</Button>
        </div>
      </div>
    );

  if (lines.length === 0)
    return (
      <div className="container-lux py-28 text-center">
        <h1 className="text-4xl sm:text-5xl">Your bag is empty</h1>
        <p className="mt-4 text-muted-foreground">Add something you love, then come back to checkout.</p>
        <Button variant="lux" size="xl" className="mt-8" asChild><Link to="/shop">Shop the collection</Link></Button>
      </div>
    );

  const summaryList = (
    <ul className="space-y-4">
      {lines.map((l) => {
        const vt = variantText(l.variant);
        return (
          <li key={`${l.productId}:${l.variantId}`} className="flex gap-3 text-sm">
            <span className="relative w-14 shrink-0 overflow-hidden rounded-md">
              <ProductVisual src={l.product.images?.[0]} shape={l.product.shape} tint={l.product.tint} label="" tag={false} />
              <span className="absolute right-1 top-1 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{l.quantity}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block leading-snug">{l.product.name}</span>
              <span className="block text-xs text-muted-foreground">{vt ? `${vt} · ` : ""}{inr(l.variant.price)} × {l.quantity}</span>
            </span>
            <span className="shrink-0 tabular-nums">{inr(l.lineTotal)}</span>
          </li>
        );
      })}
    </ul>
  );

  const discountBox = (
    <div className="flex gap-2">
      <label htmlFor="code" className="sr-only">Discount code</label>
      <input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Discount code" className="h-11 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-base sm:text-sm" />
      <Button type="button" variant="outline" className="h-11" onClick={() => toast("Discount codes will work once the store backend is connected. No discount has been applied.")}>Apply</Button>
    </div>
  );

  const edit = (s: CheckoutStep) => (
    <button type="button" onClick={() => goTo(s)} className="press inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-primary hover:bg-primary/5"><Pencil className="size-3" /> Edit</button>
  );

  return (
    <div className="container-lux py-8 pb-16 md:py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-4xl md:text-5xl">Checkout</h1>
        <Link to="/cart" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Back to bag</Link>
      </div>
      <DemoNotice className="mt-5">Demo checkout — your details stay in this browser. No payment is taken and no order is placed in this prototype.</DemoNotice>

      {/* Mobile order summary */}
      <details className="group mt-6 rounded-xl bg-secondary lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">Order summary <ChevronDown className="size-4 transition-transform group-open:rotate-180" /></span>
          <span className="tabular-nums">{summary.itemCount} {summary.itemCount === 1 ? "item" : "items"} · {inr(summary.subtotal)}</span>
        </summary>
        <div className="space-y-5 border-t border-border p-4">{summaryList}{discountBox}<OrderTotals /></div>
      </details>

      {/* Stepper */}
      <ol className="mt-8 flex gap-2" aria-label="Checkout steps">
        {CHECKOUT_STEPS.map((s, i) => {
          const current = s.id === step;
          const complete = i < idx || (i <= reached && i !== idx && Object.keys(validateStep(s.id, f, pay)).length === 0);
          const canGo = i <= reached;
          return (
            <li key={s.id} className={cn("min-w-0 flex-1", current && "flex-[2.6] sm:flex-1")}>
              <button type="button" disabled={!canGo || current} onClick={() => goTo(s.id)} aria-current={current ? "step" : undefined}
                className="group flex w-full flex-col gap-2 text-left disabled:cursor-default">
                <span className={cn("h-1 w-full rounded-full transition-colors duration-500", i <= idx ? "bg-primary" : "bg-border")} />
                <span className={cn("flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider sm:text-xs", current ? "text-foreground" : canGo ? "text-muted-foreground group-hover:text-foreground" : "text-muted-foreground/60")}>
                  <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border text-[10px]", current ? "border-primary bg-primary text-primary-foreground" : complete ? "border-primary text-primary" : "border-border")}>
                    {complete && !current ? <Check className="size-3" /> : i + 1}
                  </span>
                  <span className={cn("truncate", !current && "sr-only sm:not-sr-only")}>{s.label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-12">
        <form noValidate className="min-w-0" onSubmit={(e) => { e.preventDefault(); if (step === "review") submit(); else next(); }}>
          <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-28 text-2xl outline-none md:text-3xl">
            {step === "contact" && "Contact information"}
            {step === "address" && "Delivery address"}
            {step === "payment" && "Payment method"}
            {step === "review" && "Review your order"}
          </h2>

          <div key={step} className="animate-in fade-in slide-in-from-bottom-2 mt-6 space-y-5 duration-300">
            {step === "contact" && (
              <>
                <Field id="name" label="Full name" error={errors.name}>{inp("name", { autoComplete: "name" })}</Field>
                <Field id="email" label="Email" error={errors.email} hint="For order updates once online ordering is live.">{inp("email", { type: "email", inputMode: "email", autoComplete: "email", autoCapitalize: "off", spellCheck: false })}</Field>
                <Field id="phone" label="Mobile number" error={errors.phone} hint="10-digit Indian mobile number.">
                  <div className="flex">
                    <span className="grid h-12 shrink-0 place-items-center rounded-l-md border border-r-0 border-input bg-secondary px-3 text-sm text-muted-foreground">+91</span>
                    <input id="phone" name="phone" value={f.phone} onChange={set("phone")} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "phone-err" : undefined}
                      type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={14} placeholder="98765 43210" enterKeyHint="next" className={cn(inputCls(errors.phone), "rounded-l-none")} />
                  </div>
                </Field>
              </>
            )}

            {step === "address" && (
              <>
                <Field id="line1" label="Address line 1" error={errors.line1}>{inp("line1", { autoComplete: "address-line1", placeholder: "House / flat no., building, street" })}</Field>
                <Field id="line2" label="Address line 2" optional>{inp("line2", { autoComplete: "address-line2", placeholder: "Area, landmark" })}</Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="city" label="City" error={errors.city}>{inp("city", { autoComplete: "address-level2" })}</Field>
                  <Field id="pincode" label="PIN code" error={errors.pincode}>{inp("pincode", { inputMode: "numeric", maxLength: 6, autoComplete: "postal-code", placeholder: "6 digits" })}</Field>
                </div>
                <Field id="state" label="State / Union territory" error={errors.state}>
                  <select id="state" name="state" value={f.state} onChange={set("state")} aria-invalid={!!errors.state} aria-describedby={errors.state ? "state-err" : undefined} autoComplete="address-level1" className={inputCls(errors.state)}>
                    <option value="">Select</option>
                    {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <fieldset>
                  <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address type</legend>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Address type">
                    {ADDRESS_TYPES.map((t) => (
                      <button key={t.v} type="button" role="radio" aria-checked={f.addressType === t.v} onClick={() => setF((p) => ({ ...p, addressType: t.v }))}
                        className={cn("press h-11 rounded-full border px-5 text-sm transition-colors", f.addressType === t.v ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-input hover:border-primary")}>{t.l}</button>
                    ))}
                  </div>
                </fieldset>
              </>
            )}

            {step === "payment" && (
              <>
                <PaymentMethods value={pay} onChange={(m) => { setPay(m); setErrors((e) => ({ ...e, payment: undefined })); }} error={errors.payment} />
                <p className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /> Your choice is saved for review only. Nothing is charged here.</p>
              </>
            )}

            {step === "review" && (
              <div className="space-y-4">
                <ReviewBlock title="Contact" action={edit("contact")}>
                  <p>{f.name}</p><p>{f.email}</p><p>+91 {normalisePhone(f.phone)}</p>
                </ReviewBlock>
                <ReviewBlock title={`Delivery address · ${ADDRESS_TYPES.find((t) => t.v === f.addressType)?.l}`} action={edit("address")}>
                  <p>{f.line1}</p>{f.line2 && <p>{f.line2}</p>}<p>{f.city}, {f.state} – {f.pincode}</p>
                </ReviewBlock>
                <ReviewBlock title="Payment" action={edit("payment")}>
                  <p>{pay ? paymentLabel(pay) : "Not chosen"}</p>
                  <p className="text-xs text-muted-foreground">{pay === "cod" ? "COD availability and charges are pending client approval." : "Razorpay is not connected yet."}</p>
                </ReviewBlock>
                <ReviewBlock title={`Items (${summary.itemCount})`} action={<Link to="/cart" className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-primary hover:bg-primary/5"><Pencil className="size-3" /> Edit bag</Link>}>
                  {summaryList}
                </ReviewBlock>
                <div className="rounded-xl border border-border p-5">
                  <OrderTotals />
                  <p className="mt-3 text-xs text-muted-foreground">Discounts: none applied.</p>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  By continuing you agree to our <Link to="/terms" className="underline">Terms & Conditions</Link>, <Link to="/shipping-policy" className="underline">Shipping Policy</Link> and <Link to="/refund-policy" className="underline">Refund & Returns</Link> policy.
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            {idx > 0 ? (
              <Button type="button" variant="ghost" className="h-12 rounded-full" onClick={() => goTo(CHECKOUT_STEPS[idx - 1]!.id)}><ArrowLeft /> Back</Button>
            ) : <span />}
            <Button type="submit" variant="lux" size="xl" className="w-full sm:w-auto">
              {step === "contact" && <>Continue to delivery <ArrowRight /></>}
              {step === "address" && <>Continue to payment <ArrowRight /></>}
              {step === "payment" && <>Review order <ArrowRight /></>}
              {step === "review" && "Confirm details (demo)"}
            </Button>
          </div>
          {step === "review" && <p className="mt-3 text-center text-xs text-muted-foreground sm:text-right">No payment will be taken and no order will be placed.</p>}
        </form>

        <aside className="hidden h-fit space-y-5 rounded-xl bg-secondary p-6 lg:sticky lg:top-24 lg:block">
          <h2 className="text-2xl">Order summary</h2>
          {summaryList}
          {discountBox}
          <OrderTotals />
        </aside>
      </div>
    </div>
  );
}

function ReviewBlock({ title, action, children }: { title: string; action: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {action}
      </div>
      <div className="space-y-0.5 break-words text-sm">{children}</div>
    </section>
  );
}
