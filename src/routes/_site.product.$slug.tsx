import { Link, createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Check, ExternalLink, Heart, RotateCcw, ShoppingBag, Truck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { SampleBadge } from "@/components/shop/DemoNotice";
import { ProductCard } from "@/components/shop/ProductCard";
import { ProductGallery } from "@/components/shop/ProductGallery";
import { QtyStepper } from "@/components/site/CartLines";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { categories } from "@/lib/mock-data";
import { inr } from "@/lib/format";
import { qtyLimitText, roomLeft } from "@/lib/pricing";
import { useShop } from "@/lib/shop-store";
import { cn } from "@/lib/utils";
import {
  availabilityOf, checkVariant, initialVariantId, isUnconfirmed, mrpOf, productInfoSections, requiresChoice, variantKindLabel,
} from "@/lib/variants";
import { productService } from "@/services/productService";
import { StaggerContainer, TextReveal } from "@/components/motion/Reveal";

export const Route = createFileRoute("/_site/product/$slug")({
  loader: async ({ params }) => {
    const product = await productService.getBySlug(params.slug);
    if (!product) throw notFound();
    const related = await productService.related(product);
    const alsoLike = await productService.alsoLike(product, related.map((r) => r.id));
    return { product, related, alsoLike };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.product;
    if (!p) return { meta: [{ title: "Product unavailable | Being You – Always" }, { name: "robots", content: "noindex" }] };
    return {
      meta: [
        { title: `${p.name} | Being You – Always` },
        { name: "description", content: p.shortDescription },
        { property: "og:title", content: `${p.name} | Being You – Always` },
        { property: "og:description", content: p.shortDescription },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="container-lux py-32 text-center">
      <h1 className="text-5xl">Product not found</h1>
      <Button variant="lux" size="xl" className="mt-8" asChild><Link to="/shop">Back to shop</Link></Button>
    </div>
  ),
  component: ProductPage,
});

function ProductPage() {
  const { product: p, related, alsoLike } = Route.useLoaderData();
  const { add, toggleWish, isWished, qtyInBag, items } = useShop();
  const navigate = useNavigate();
  const [variantId, setVariantId] = useState<string | null>(() => initialVariantId(p));
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pop, setPop] = useState(0);
  const [showSticky, setShowSticky] = useState(false);
  const busy = useRef(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const variantsRef = useRef<HTMLFieldSetElement>(null);

  // Reset selection when navigating between products.
  useEffect(() => { setVariantId(initialVariantId(p)); setQty(1); setError(null); setAdded(false); }, [p.id]);

  // Mobile sticky bar shows only while the main purchase buttons are off-screen.
  useEffect(() => {
    const el = actionsRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShowSticky(!e!.isIntersecting), { rootMargin: "0px 0px -40px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const choose = requiresChoice(p);
  const kind = variantKindLabel(p);
  const v = p.variants.find((x) => x.id === variantId) ?? null;
  const shown = v ?? p.variants[0]!;
  const mrp = mrpOf(shown);
  const prices = new Set(p.variants.map((x) => x.price));
  const priceIsFrom = !v && prices.size > 1;
  const avail = availabilityOf(v ?? (choose ? null : shown));
  const allOut = p.variants.every((x) => x.stock <= 0);
  const cat = categories.find((c) => c.slug === p.category)!;
  const wished = isWished(p.id);
  const inBag = v ? qtyInBag(p.id, v.id) : 0;
  const room = roomLeft(inBag);
  const info = productInfoSections(p);
  void items; // re-render when the bag changes so inBag stays current

  const validate = () => {
    const r = checkVariant(p, variantId);
    if (!r.ok) {
      setError(r.error);
      variantsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      variantsRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus({ preventScroll: true });
      return null;
    }
    if (room === 0) { setError(qtyLimitText.full); return null; }
    setError(null);
    return r.variant;
  };

  const addToBag = () => {
    if (busy.current) return;
    const chosen = validate();
    if (!chosen) return;
    busy.current = true;
    const r = add(p.id, chosen.id, Math.min(qty, room));
    if (r.ok) { setAdded(true); setQty(1); setTimeout(() => setAdded(false), 1800); }
    setTimeout(() => { busy.current = false; }, 700);
  };

  const buyNow = () => {
    if (busy.current) return;
    const chosen = validate();
    if (!chosen) return;
    busy.current = true;
    const r = add(p.id, chosen.id, Math.min(qty, room), { openDrawer: false });
    if (r.ok) navigate({ to: "/checkout" });
    setTimeout(() => { busy.current = false; }, 700);
  };

  const pick = (id: string) => { setVariantId(id); setQty(1); setError(null); };

  const priceBlock = (big = true) => (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={`${shown.price}-${priceIsFrom}`} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={{ duration: 0.25 }}
          className={cn("font-semibold tabular-nums", big ? "text-3xl" : "text-lg")}>
          {priceIsFrom ? "From " : ""}{inr(priceIsFrom ? Math.min(...prices) : shown.price)}
        </motion.span>
      </AnimatePresence>
      {mrp && <span className={cn("text-muted-foreground", big ? "text-base" : "text-xs")}>MRP <span className="line-through">{inr(mrp)}</span></span>}
    </div>
  );

  const addLabel = added ? <><Check /> Added to bag</> : allOut ? "Currently unavailable" : <><ShoppingBag /> Add to bag</>;

  return (
    <>
      <nav aria-label="Breadcrumb" className="container-lux py-5 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link> / <Link to="/shop" className="hover:text-foreground">Shop</Link> / <Link to={`/${cat.slug}` as "/skincare"} className="hover:text-foreground">{cat.name}</Link> / <span className="text-foreground">{p.name}</span>
      </nav>

      <div className="container-lux grid gap-8 pb-12 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-14 lg:gap-20">
        <div className="min-w-0 md:sticky md:top-24 md:self-start">
          <ProductGallery images={p.images ?? []} name={p.name} shape={p.shape} tint={p.tint} />
        </div>

        <div className="min-w-0 hero-in" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center gap-2">
            <Link to={`/${cat.slug}` as "/skincare"} className="eyebrow hover:text-primary">{cat.name}</Link>
            {p.isSample && <SampleBadge />}
          </div>
          <h1 className="mt-3 text-[2rem] leading-[1.1] sm:text-4xl md:text-5xl">{p.name}</h1>
          {!isUnconfirmed(p.shortDescription) && <p className="mt-4 leading-relaxed text-muted-foreground">{p.shortDescription}</p>}

          <div className="mt-6">
            {priceBlock()}
            <p className="mt-1 text-xs text-muted-foreground">Price as listed by Being You · taxes and shipping to be confirmed</p>
          </div>

          {/* Variant selection */}
          {choose ? (
            <fieldset ref={variantsRef} className="mt-8" aria-describedby={error ? "variant-error" : undefined}>
              <legend className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="eyebrow">{kind === "shade" ? "Shade" : "Size"}</span>
                <span className={cn("font-medium", !v && "text-muted-foreground")}>{v ? v.label : `Choose a ${kind}`}</span>
              </legend>
              <div className="mt-3 flex flex-wrap gap-2.5" role="radiogroup" aria-label={`Choose a ${kind}`}>
                {p.variants.map((x) => {
                  const on = x.id === variantId;
                  const unavailable = x.stock <= 0;
                  return (
                    <button
                      key={x.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={unavailable}
                      onClick={() => pick(x.id)}
                      aria-label={`${x.label}${unavailable ? " — currently unavailable" : ""}${prices.size > 1 ? `, ${inr(x.price)}` : ""}`}
                      className={cn(
                        "press flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all duration-200",
                        on ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-input hover:border-primary",
                        error && !v && "border-destructive/60",
                        unavailable && "cursor-not-allowed opacity-45 line-through",
                      )}
                    >
                      {x.swatch && <span className={cn("size-5 rounded-full border border-border transition-transform duration-300", on && "scale-110")} style={{ background: x.swatch }} aria-hidden />}
                      {x.label}
                      {on && <Check className="size-3.5 text-primary" aria-hidden />}
                      {prices.size > 1 && <span className="text-xs text-muted-foreground">{inr(x.price)}</span>}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : (
            !isUnconfirmed(shown.label) && (
              <p className="mt-8 text-sm"><span className="eyebrow mr-2">{shown.kind === "shade" ? "Shade" : "Size"}</span>{shown.label}</p>
            )
          )}

          <AnimatePresence>
            {error && (
              <motion.p id="variant-error" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-3 flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" /> {error}
              </motion.p>
            )}
          </AnimatePresence>

          {avail && (
            <p className={cn("mt-5 flex items-center gap-2 text-sm", avail.ok ? "text-success" : "text-destructive")}>
              <span className="size-2 rounded-full bg-current" />{avail.label}
            </p>
          )}

          {/* Purchase actions */}
          <div ref={actionsRef} className="mt-6 space-y-3">
            <div className="flex items-center gap-3">
              <QtyStepper size="lg" value={qty} label={p.name} max={Math.max(1, room)} onChange={(n) => setQty(Math.max(1, Math.min(n, Math.max(1, room))))} />
              <Button variant="lux" size="xl" className="relative h-12 min-w-0 flex-1 overflow-hidden" disabled={allOut} onClick={addToBag} aria-live="polite">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={added ? "a" : "b"} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={{ duration: 0.2 }} className="flex items-center gap-2">{addLabel}</motion.span>
                </AnimatePresence>
              </Button>
              <button type="button" onClick={() => { toggleWish(p.id); setPop((n) => n + 1); }} aria-pressed={wished} aria-label={wished ? "Remove from wishlist" : "Save to wishlist"}
                className="press grid size-12 shrink-0 place-items-center rounded-full border border-input transition-colors hover:border-accent">
                <Heart key={pop} className={cn("size-5", pop > 0 && "heart-pop", wished && "fill-accent text-accent")} />
              </button>
            </div>
            <Button variant="luxOutline" size="xl" className="w-full" disabled={allOut} onClick={buyNow}>Buy now</Button>
            {inBag > 0 && (
              <p className="text-xs text-muted-foreground">
                {qtyLimitText.inBag(inBag)}
              </p>
            )}
          </div>

          <div className="mt-8 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
            <Link to="/shipping-policy" className="flex items-start gap-2.5 rounded-md bg-secondary p-3.5 transition-colors hover:bg-secondary/70">
              <Truck className="mt-0.5 size-4 shrink-0 text-primary" /><span><span className="block font-medium text-foreground">Shipping</span>Charges pending confirmation · read policy</span>
            </Link>
            <Link to="/refund-policy" className="flex items-start gap-2.5 rounded-md bg-secondary p-3.5 transition-colors hover:bg-secondary/70">
              <RotateCcw className="mt-0.5 size-4 shrink-0 text-primary" /><span><span className="block font-medium text-foreground">Refund & Returns</span>Read our current policy</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Product information */}
      <section aria-labelledby="info-heading" className="border-t border-border bg-secondary/40">
        <div className="container-lux grid gap-8 py-14 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-16 md:py-20">
          <div>
            <p className="eyebrow">About this product</p>
            <h2 id="info-heading" className="mt-3 text-3xl md:text-4xl">The details</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Information here comes from Being You's original product listing. Anything not yet confirmed by the brand is left out rather than guessed.</p>
          </div>
          <Accordion type="multiple" defaultValue={["desc"]} className="min-w-0">
            {info.description && (
              <AccordionItem value="desc"><AccordionTrigger className="font-serif text-xl font-normal">Description</AccordionTrigger>
                <AccordionContent className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{info.description}</AccordionContent></AccordionItem>
            )}
            {info.ingredients.length > 0 && (
              <AccordionItem value="ing"><AccordionTrigger className="font-serif text-xl font-normal">Ingredients</AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{info.ingredients.join(", ")}</AccordionContent></AccordionItem>
            )}
            {info.directions && (
              <AccordionItem value="dir"><AccordionTrigger className="font-serif text-xl font-normal">How to use</AccordionTrigger>
                <AccordionContent className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{info.directions}</AccordionContent></AccordionItem>
            )}
            <AccordionItem value="info"><AccordionTrigger className="font-serif text-xl font-normal">Product details</AccordionTrigger>
              <AccordionContent>
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Category</dt><dd>{cat.name}</dd>
                  {choose && <><dt className="text-muted-foreground">{kind === "shade" ? "Shades" : "Sizes"}</dt><dd>{p.variants.map((x) => x.label).join(", ")}</dd></>}
                  {!choose && !isUnconfirmed(shown.label) && <><dt className="text-muted-foreground">{shown.kind === "shade" ? "Shade" : "Size"}</dt><dd>{shown.label}</dd></>}
                  {info.details.map((d) => <div key={d.label} className="contents"><dt className="text-muted-foreground">{d.label}</dt><dd>{d.value}</dd></div>)}
                </dl>
                {p.sourceUrl && <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary underline-offset-4 hover:underline">View original listing <ExternalLink className="size-3" /></a>}
              </AccordionContent></AccordionItem>
            <AccordionItem value="ship"><AccordionTrigger className="font-serif text-xl font-normal">Shipping & returns</AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                <p>Shipping charges and delivery times are pending confirmation by Being You and will be shown before you pay.</p>
                <p>Please read our <Link to="/shipping-policy" className="underline">Shipping Policy</Link> and <Link to="/refund-policy" className="underline">Refund & Returns policy</Link> for the current terms.</p>
              </AccordionContent></AccordionItem>
          </Accordion>
        </div>
      </section>

      {related.length > 0 && (
        <section className="container-lux py-16 md:py-20">
          <TextReveal text={`More from ${cat.name}`} className="mb-8 text-3xl md:text-4xl" />
          <StaggerContainer className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">{related.map((r, i) => <ProductCard key={r.id} product={r} index={i} />)}</StaggerContainer>
        </section>
      )}
      {alsoLike.length > 0 && (
        <section className="container-lux pb-28 md:pb-20">
          <TextReveal text="You may also like" className="mb-2 text-3xl md:text-4xl" />
          <p className="mb-8 text-sm text-muted-foreground">Chosen for the same skin or hair concern.</p>
          <StaggerContainer className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">{alsoLike.map((r, i) => <ProductCard key={r.id} product={r} index={i} />)}</StaggerContainer>
        </section>
      )}
      <div className="h-20 md:hidden" aria-hidden />

      {/* Mobile sticky purchase bar */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lift backdrop-blur transition-transform duration-300 md:hidden",
          showSticky ? "translate-y-0" : "pointer-events-none translate-y-full",
        )}
        aria-hidden={!showSticky}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">{v && !isUnconfirmed(v.label) ? v.label : choose ? `Choose a ${kind}` : p.name}</p>
            {priceBlock(false)}
          </div>
          <Button variant="lux" size="xl" className="h-12 shrink-0 px-6" disabled={allOut} onClick={addToBag} tabIndex={showSticky ? 0 : -1}>
            {added ? <><Check /> Added</> : choose && !v ? `Choose ${kind}` : "Add to bag"}
          </Button>
        </div>
        {error && showSticky && <p className="mt-2 text-xs text-destructive" role="alert">{error}</p>}
      </div>
    </>
  );
}
