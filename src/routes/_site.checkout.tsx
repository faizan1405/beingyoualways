import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, CloudOff, Loader2, Pencil, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { bagReminderOn, clearCheckoutDraft, currentCheckoutKey, loadCheckoutDraft, resetCheckoutKey, saveCheckoutDraft, setBagReminderOn } from "@/lib/checkout-draft";
import { inr, inrPaise } from "@/lib/format";
import { orderHash, rememberOrderLink } from "@/lib/order-links";
import { openRazorpay } from "@/lib/razorpay-checkout";
import { useShop } from "@/lib/shop-store";
import type { AddressType, PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";
import { variantText } from "@/lib/variants";
import { ApiError, BackendOfflineError, isBackendConfigured } from "@/services/api";
import { shopService, summaryFromServer, type OrderResult, type Quote } from "@/services/shopService";
import { whatsappShop } from "@/services/whatsappLiveService";

export const Route = createFileRoute("/_site/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout | Being You – Always" },
      { name: "description", content: "Enter your contact, delivery and payment details to place your Being You – Always order." },
      { property: "og:title", content: "Checkout | Being You – Always" },
      { property: "og:description", content: "Secure checkout for Being You – Always plant-based beauty." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkout,
});


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

// Maps server field names to the checkout form's fields.
const FIELD_MAP: Record<string, keyof CheckoutForm> = {
  "contact.name": "name", "contact.email": "email", "contact.phone": "phone", "address.line1": "line1", "address.line2": "line2",
  "address.city": "city", "address.state": "state", "address.pincode": "pincode",
};

function Checkout() {
  const { lines, summary, clear } = useShop();
  const navigate = useNavigate();
  const live = isBackendConfigured();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteProblem, setQuoteProblem] = useState<string | null>(null);
  const [appliedCode, setAppliedCode] = useState("");
  const [placing, setPlacing] = useState(false);
  const [quoteTick, setQuoteTick] = useState(0);
  const [f, setF] = useState<CheckoutForm>(emptyCheckout);
  const [pay, setPay] = useState<PaymentMethod | null>(null);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [step, setStep] = useState<CheckoutStep>("contact");
  const [reached, setReached] = useState(0);
  const [code, setCode] = useState("");
  // WhatsApp choices: never pre-ticked; "offers" also covers the single 6-hour bag reminder
  const [waUpdates, setWaUpdates] = useState(false);
  const [waOffers, setWaOffers] = useState(false);
  // read after mount (browser storage), so server and browser render the same first frame
  const [bagReminder, setBagReminder] = useState(false);
  useEffect(() => { setBagReminder(bagReminderOn()); }, []);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const loaded = useRef(false);

  // Details survive a reload or step change in THIS tab only (sessionStorage),
  // and are wiped when checkout finishes, the shopper clears them, or the tab closes.
  useEffect(() => {
    const d = loadCheckoutDraft();
    if (d) { setF(d.form); setPay(d.pay); }
    loaded.current = true;
  }, []);
  useEffect(() => { if (loaded.current) saveCheckoutDraft(f, pay); }, [f, pay]);

  // Live: the server prices the bag (database prices, stock, discount, shipping, COD charge).
  const destination = /^[1-9]\d{5}$/.test(f.pincode.trim()) && f.state ? { state: f.state, pincode: f.pincode.trim() } : undefined;
  const quoteKey = JSON.stringify([lines.map((l) => [l.productId, l.variantId, l.quantity, l.variant.price]), destination, pay, appliedCode, quoteTick]);
  useEffect(() => {
    if (!live || lines.length === 0) return;
    let stale = false;
    const t = setTimeout(() => {
      shopService.quote({
        lines: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity, seenUnitPrice: l.variant.price })),
        ...(destination ? { destination } : {}), ...(pay ? { paymentMethod: pay } : {}), ...(appliedCode ? { discountCode: appliedCode } : {}),
      }).then((q) => { if (!stale) { setQuote(q); setQuoteProblem(null); } })
        .catch((e) => { if (!stale) setQuoteProblem(e instanceof Error ? e.message : "Can't reach the store right now."); });
    }, 250);
    return () => { stale = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, quoteKey]);
  const shownSummary = useMemo(() => (live && quote?.totals ? summaryFromServer(quote.totals, summary.itemCount) : summary), [live, quote, summary]);
  const lineIssues = live ? (quote?.lines ?? []).filter((l) => l.status !== "ok") : [];
  const priceNotes = live ? (quote?.lines ?? []).filter((l) => l.priceChanged) : [];

  const forgetDetails = () => {
    clearCheckoutDraft();
    setF(emptyCheckout); setPay(null); setErrors({}); setReached(0); setStep("contact");
    toast("Your details have been cleared from this browser");
  };

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

  /** Tells the store a checkout started, so the 6-hour reminder can be scheduled (only with consent) or cancelled. */
  const pingReminder = (consent: boolean) => {
    if (!live || lines.length === 0 || Object.keys(validateStep("contact", f, pay)).length) return;
    void whatsappShop.checkoutStarted({
      checkoutKey: currentCheckoutKey(), lines: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
      contact: { name: f.name.trim(), phone: normalisePhone(f.phone) }, reminderConsent: consent,
    }).catch(() => { /* a missed reminder never blocks checkout */ });
  };

  const next = () => {
    const errs = validateStep(step, f, pay);
    setErrors(errs);
    const keys = Object.keys(errs);
    if (keys.length) {
      toast.error("Please check the highlighted details");
      document.getElementById(keys[0]!)?.focus();
      return;
    }
    // A reminder chosen on the bag page stays on unless the shopper turns it off here — leaving this box empty doesn't cancel it.
    if (step === "contact" && (waOffers || !bagReminderOn())) pingReminder(waOffers);
    const n = CHECKOUT_STEPS[idx + 1];
    if (n) goTo(n.id);
  };

  const openOrder = (r: OrderResult) => {
    rememberOrderLink(r.order.orderNumber, r.accessToken);
    void navigate({ to: "/order/$orderNumber", params: { orderNumber: r.order.orderNumber }, hash: orderHash(r.accessToken) });
  };
  const finishPlaced = (r: OrderResult) => {
    // The order now exists on the server: start a fresh checkout next time, and empty the bag once it's paid or COD.
    if (r.order.paymentStatus !== "PENDING" || r.order.status === "CANCELLED") { clear(); clearCheckoutDraft(); resetCheckoutKey(); }
    openOrder(r);
  };

  const submit = async () => {
    const bad = firstInvalidStep(f, pay);
    if (bad) { setErrors(validateStep(bad, f, pay)); goTo(bad); toast.error("Some details need attention"); return; }
    if (!live || !pay || placing) return;
    setPlacing(true);
    const body = (key: string) => ({
      checkoutKey: key,
      lines: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity, seenUnitPrice: l.variant.price })),
      contact: { name: f.name.trim(), email: f.email.trim(), phone: normalisePhone(f.phone) },
      address: { line1: f.line1.trim(), line2: f.line2.trim(), city: f.city.trim(), state: f.state, pincode: f.pincode.trim(), type: f.addressType },
      paymentMethod: pay, ...(appliedCode ? { discountCode: appliedCode } : {}),
      whatsapp: { orderUpdates: waUpdates, offers: waOffers },
    });
    try {
      let r: OrderResult;
      try { r = await shopService.placeOrder(body(currentCheckoutKey())); }
      catch (e) { if (e instanceof ApiError && e.code === "checkout_reused") r = await shopService.placeOrder(body(resetCheckoutKey())); else throw e; }
      if (r.order.paymentMethod === "cod" || r.order.paymentStatus !== "PENDING") { finishPlaced(r); return; }
      if (!r.payment) { toast.error("Your order is saved, but online payment couldn't start. You can try again from the order page."); openOrder(r); return; }
      const access = { orderNumber: r.order.orderNumber, token: r.accessToken };
      const outcome = await openRazorpay(r.payment, { name: "Being You – Always", color: "#263B31" });
      if (outcome.kind === "success") {
        try { finishPlaced(await shopService.verifyRazorpay(access, outcome.result)); }
        catch (e) { toast.error(e instanceof Error ? e.message : "We couldn't confirm the payment yet."); openOrder(r); }
        return;
      }
      const after = await shopService.reportProblem(access, outcome.kind === "failed" ? { kind: "failed", reason: outcome.reason, ...(outcome.paymentId ? { razorpay_payment_id: outcome.paymentId } : {}) } : { kind: "cancelled" }).catch(() => r);
      toast(outcome.kind === "failed" ? "The payment didn't go through. Your order is saved — you can try again." : "Payment window closed. Your order is saved — you can complete payment from the order page.");
      openOrder(after);
    } catch (e) {
      if (e instanceof ApiError && e.code === "validation_failed" && e.details?.length) {
        const errs: CheckoutErrors = {};
        for (const d of e.details) { const k = FIELD_MAP[d.field]; if (k) errs[k] = d.message; }
        setErrors(errs);
        const first = firstInvalidStep({ ...f }, pay) ?? (errs.name || errs.email || errs.phone ? "contact" : "address");
        goTo(first);
        toast.error("Some details need attention");
      } else if (e instanceof ApiError && ["cart_changed", "insufficient_stock", "discount_invalid", "cod_unavailable", "no_delivery"].includes(e.code)) {
        setQuoteTick((n) => n + 1);
        toast.error(e.message);
      } else {
        toast.error(e instanceof BackendOfflineError || e instanceof ApiError ? e.message : "Something went wrong. Nothing was charged — please try again.");
      }
    } finally {
      setPlacing(false);
    }
  };

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
      <Button type="button" variant="outline" className="h-11" onClick={() => {
        if (!live) { toast("Discount codes work once the shop is connected to the store server. No discount has been applied."); return; }
        setAppliedCode(code.trim().toUpperCase());
      }}>Apply</Button>
    </div>
  );
  const discountNote = live && quote?.discount ? (
    <p role="status" className={cn("-mt-3 text-xs", quote.discount.ok ? "text-success" : "text-destructive")}>
      {quote.discount.ok ? `${quote.discount.code} applied — you save ${inrPaise(quote.discount.amountPaise)}.` : quote.discount.message ?? "This code can't be used."}
      {" "}<button type="button" className="underline" onClick={() => { setAppliedCode(""); setCode(""); }}>Remove</button>
    </p>
  ) : null;
  const bagNotices = (lineIssues.length > 0 || priceNotes.length > 0 || quoteProblem) ? (
    <div role="alert" className="space-y-1.5 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs leading-relaxed">
      {quoteProblem && <p className="flex gap-1.5"><CloudOff className="size-3.5 shrink-0" /> {quoteProblem}</p>}
      {lineIssues.map((l) => <p key={l.variantId} className="flex gap-1.5"><AlertTriangle className="size-3.5 shrink-0 text-destructive" /> {l.message}</p>)}
      {priceNotes.map((l) => <p key={`p-${l.variantId}`}>The price of {l.name}{l.variantLabel ? ` (${l.variantLabel})` : ""} is now {inrPaise(l.priceChanged!.toPaise)} (was {inrPaise(l.priceChanged!.fromPaise)}). Totals use the current price.</p>)}
      {lineIssues.length > 0 && <p><Link to="/cart" className="font-semibold underline">Update your bag</Link> to continue.</p>}
    </div>
  ) : null;

  const edit = (s: CheckoutStep) => (
    <button type="button" onClick={() => goTo(s)} className="btn-motion inline-flex h-9 items-center gap-1.5 rounded-btn border border-transparent px-3 text-xs font-medium text-primary hover:border-primary/30 hover:bg-primary/5"><Pencil className="size-3" /> Edit</button>
  );

  return (
    <div className="container-lux py-8 pb-16 md:py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-4xl md:text-5xl">Checkout</h1>
        <Link to="/cart" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Back to bag</Link>
      </div>
      {live ? (
        <p className="mt-5 flex items-start gap-2 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /> Your contact and delivery details stay in this browser tab until you place the order or press “Clear my details”. Card and UPI details are entered with Razorpay only — never on this site.</p>
      ) : (
        <DemoNotice className="mt-5"><strong>Development preview — not connected to the store server.</strong> You can try every step, but orders can't be placed and nothing is charged here. Ordering works on the live shop once it is connected to the Hostinger store server. Details you type stay in this browser tab only.</DemoNotice>
      )}
      <div className="mt-2 flex justify-end">
        <button type="button" onClick={forgetDetails} className="press text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">Clear my details</button>
      </div>

      {/* Mobile order summary */}
      <details className="group mt-6 rounded-xl bg-secondary lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">Order summary <ChevronDown className="size-4 transition-transform group-open:rotate-180" /></span>
          <span className="tabular-nums">{summary.itemCount} {summary.itemCount === 1 ? "item" : "items"} · {inr(summary.subtotal)}</span>
        </summary>
        <div className="space-y-5 border-t border-border p-4">{summaryList}{bagNotices}{discountBox}{discountNote}<OrderTotals summary={shownSummary} /></div>
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
        <form noValidate className="min-w-0" onSubmit={(e) => { e.preventDefault(); if (step === "review") void submit(); else next(); }}>
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
                {live && (
                  <fieldset className="space-y-2.5 rounded-md border border-border p-4 text-sm">
                    <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">WhatsApp (optional)</legend>
                    <label className="flex items-start gap-2.5"><input type="checkbox" className="mt-1" checked={waUpdates} onChange={(e) => setWaUpdates(e.target.checked)} /> <span>Send my order updates on WhatsApp (confirmation, shipping and delivery).</span></label>
                    <label className="flex items-start gap-2.5"><input type="checkbox" className="mt-1" checked={waOffers} onChange={(e) => { setWaOffers(e.target.checked); if (!e.target.checked && !bagReminderOn()) pingReminder(false); }} /> <span>Send me offers on WhatsApp, and one reminder if I leave without finishing this order. Reply STOP any time.</span></label>
                    {bagReminder && (
                      <p className="text-xs text-muted-foreground">
                        You asked for one bag reminder on WhatsApp from your bag page.{" "}
                        <button type="button" className="underline" onClick={() => {
                          void whatsappShop.saveBagReminder({ checkoutKey: currentCheckoutKey(), lines: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })), reminderConsent: false })
                            .then(() => { setBagReminderOn(false); setBagReminder(false); toast("Bag reminder cancelled"); })
                            .catch((err) => toast.error(err instanceof Error ? err.message : "Couldn't cancel it. Please try again."));
                        }}>Cancel it</button>
                      </p>
                    )}
                  </fieldset>
                )}
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
                        className={cn("btn-motion h-11 rounded-btn border px-5 text-sm", f.addressType === t.v ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-input hover:border-primary")}>{t.l}</button>
                    ))}
                  </div>
                </fieldset>
              </>
            )}

            {step === "payment" && (
              <>
                <PaymentMethods value={pay} onChange={(m) => { setPay(m); setErrors((e) => ({ ...e, payment: undefined })); }} error={errors.payment}
                  live={live ? (quote ? { cod: { available: quote.methods.cod.available, feePaise: quote.methods.cod.feePaise, reason: quote.methods.cod.reason }, razorpay: quote.methods.razorpay } : quoteProblem ? { cod: { available: false, feePaise: null, reason: quoteProblem }, razorpay: { available: false, testMode: false, reason: quoteProblem } } : "loading") : undefined} />
                <p className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /> {live ? "You'll be charged only after you confirm on the next step. Online payments are verified by our server with Razorpay." : "Development preview: nothing is charged and no order is placed."}</p>
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
                  <p className="text-xs text-muted-foreground">
                    {!live ? "Not connected in this preview — nothing is charged."
                      : pay === "cod" ? (quote?.methods.cod.available ? `Pay in cash when your order arrives${quote.methods.cod.feePaise ? ` (COD charge ${inrPaise(quote.methods.cod.feePaise)})` : ""}.` : quote?.methods.cod.reason ?? "Checking…")
                      : quote?.methods.razorpay.available ? `UPI, cards, netbanking or wallets in the secure Razorpay window${quote.methods.razorpay.testMode ? " — TEST MODE, no real money is taken" : ""}.` : quote?.methods.razorpay.reason ?? "Checking…"}
                  </p>
                </ReviewBlock>
                <ReviewBlock title={`Items (${summary.itemCount})`} action={<Link to="/cart" className="btn-motion inline-flex h-9 items-center gap-1.5 rounded-btn border border-transparent px-3 text-xs font-medium text-primary hover:border-primary/30 hover:bg-primary/5"><Pencil className="size-3" /> Edit bag</Link>}>
                  {summaryList}
                </ReviewBlock>
                {bagNotices}
                <div className="rounded-xl border border-border p-5">
                  <OrderTotals summary={shownSummary} />
                  <p className="mt-3 text-xs text-muted-foreground">{live && quote?.discount?.ok ? `Discount: ${quote.discount.code}` : "Discounts: none applied."}</p>
                </div>
                {live && quote && quote.blockers.length > 0 && (
                  <div role="alert" className="space-y-1 rounded-md border border-accent/50 bg-accent/10 p-4 text-sm">
                    {quote.blockers.filter((b) => b.code !== "cart_changed").map((b) => <p key={b.code}>{b.message}</p>)}
                  </div>
                )}
                <p className="text-xs leading-relaxed text-muted-foreground">
                  By continuing you agree to our <Link to="/terms" className="underline">Terms & Conditions</Link>, <Link to="/shipping-policy" className="underline">Shipping Policy</Link> and <Link to="/refund-policy" className="underline">Refund & Returns</Link> policy.
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            {idx > 0 ? (
              <Button type="button" variant="ghost" className="h-12" onClick={() => goTo(CHECKOUT_STEPS[idx - 1]!.id)}><ArrowLeft /> Back</Button>
            ) : <span />}
            <Button type="submit" variant="lux" size="xl" className="w-full sm:w-auto" aria-busy={placing}
              disabled={step === "review" && (!live || placing || !quote?.canPlaceOrder)}>
              {step === "contact" && <>Continue to delivery <ArrowRight /></>}
              {step === "address" && <>Continue to payment <ArrowRight /></>}
              {step === "payment" && <>Review order <ArrowRight /></>}
              {step === "review" && (!live ? "Ordering not connected" : placing ? <><Loader2 className="animate-spin" /> Placing order…</> : pay === "razorpay" ? <>Place order &amp; pay {quote?.totals ? inrPaise(quote.totals.totalPaise) : ""}</> : <>Place order {quote?.totals ? `· ${inrPaise(quote.totals.totalPaise)}` : ""}</>)}
            </Button>
          </div>
          {step === "review" && (
            <p className="mt-3 text-center text-xs text-muted-foreground sm:text-right">
              {!live ? "Development preview: the store server isn't connected, so no order can be placed and nothing is charged."
                : !quote ? "Checking prices and stock with the store…"
                : pay === "razorpay" ? "The secure Razorpay window opens next. Your order is confirmed only after the payment is verified."
                : "Your order is placed when you press the button — you pay in cash on delivery."}
            </p>
          )}
        </form>

        <aside className="hidden h-fit space-y-5 rounded-xl bg-secondary p-6 lg:sticky lg:top-24 lg:block">
          <h2 className="text-2xl">Order summary</h2>
          {summaryList}
          {bagNotices}
          {discountBox}
          {discountNote}
          <OrderTotals summary={shownSummary} />
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
