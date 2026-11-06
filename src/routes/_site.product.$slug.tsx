import { Link, createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { Heart, Truck, RotateCcw } from "lucide-react";
import { useState } from "react";

import { SampleBadge } from "@/components/shop/DemoNotice";
import { ProductCard } from "@/components/shop/ProductCard";
import { ProductVisual } from "@/components/shop/ProductVisual";
import { QtyStepper } from "@/components/site/CartLines";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { categories } from "@/lib/mock-data";
import { inr } from "@/lib/format";
import { useShop } from "@/lib/shop-store";
import { cn } from "@/lib/utils";
import { productService } from "@/services/productService";

export const Route = createFileRoute("/_site/product/$slug")({
  loader: async ({ params }) => {
    const product = await productService.getBySlug(params.slug);
    if (!product) throw notFound();
    return { product, related: await productService.related(product) };
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
  const { product: p, related } = Route.useLoaderData();
  const { add, toggleWish, isWished } = useShop();
  const navigate = useNavigate();
  const [variantId, setVariantId] = useState((p.variants.find((v) => v.stock > 0) ?? p.variants[0]!).id);
  const [qty, setQty] = useState(1);
  const [img, setImg] = useState(0);
  const v = p.variants.find((x) => x.id === variantId)!;
  const cat = categories.find((c) => c.slug === p.category)!;
  const wished = isWished(p.id);
  const stockText = v.stock === 0 ? "Out of stock" : v.stock <= 5 ? `Only ${v.stock} left` : "In stock";

  return (
    <>
      <div className="container-lux py-6 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link> / <Link to={`/${cat.slug}` as "/skincare"} className="hover:text-foreground">{cat.name}</Link> / <span className="text-foreground">{p.name}</span>
      </div>
      <div className="container-lux grid gap-10 pb-32 md:grid-cols-2 md:gap-16 md:pb-20">
        <div className="md:sticky md:top-24 md:self-start">
          <ProductVisual shape={p.shape} tint={p.tint} label={`${p.name} view ${img + 1}`} variant={img} className="rounded-xl" />
          <div className="mt-3 grid grid-cols-4 gap-3" role="group" aria-label="Product gallery">
            {[0, 1, 2, 3].map((i) => (
              <button key={i} onClick={() => setImg(i)} aria-label={`Show image ${i + 1}`} aria-pressed={img === i} className={cn("overflow-hidden rounded-md border-2 transition", img === i ? "border-primary" : "border-transparent opacity-70 hover:opacity-100")}>
                <ProductVisual shape={p.shape} tint={p.tint} label="" variant={i} tag={false} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2"><p className="eyebrow">{cat.name}</p><SampleBadge /></div>
          <h1 className="mt-3 text-4xl leading-tight md:text-6xl">{p.name}</h1>
          <p className="mt-3 text-muted-foreground">{p.shortDescription}</p>
          <div className="mt-6 flex items-baseline gap-3">
            <span className="text-2xl font-semibold">{inr(v.price)}</span>
            {v.compareAtPrice && <span className="text-muted-foreground line-through">{inr(v.compareAtPrice)}</span>}
            <span className="text-xs text-muted-foreground">Sample price · incl. taxes</span>
          </div>

          <fieldset className="mt-8">
            <legend className="eyebrow">{v.kind === "shade" ? "Shade" : "Size"}: <span className="text-foreground">{v.label}</span></legend>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {p.variants.map((x) => (
                <button
                  key={x.id}
                  onClick={() => { setVariantId(x.id); setQty(1); }}
                  aria-pressed={x.id === variantId}
                  aria-label={`${x.label}${x.stock === 0 ? " (out of stock)" : ""}`}
                  className={cn("flex h-11 items-center gap-2 rounded-full border px-4 text-sm transition",
                    x.id === variantId ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-input hover:border-primary",
                    x.stock === 0 && "opacity-50 line-through")}
                >
                  {x.swatch && <span className="size-5 rounded-full border border-border" style={{ background: x.swatch }} />}
                  {x.label}
                </button>
              ))}
            </div>
          </fieldset>

          <p className={cn("mt-5 flex items-center gap-2 text-sm", v.stock === 0 ? "text-destructive" : v.stock <= 5 ? "text-warning" : "text-success")}>
            <span className="size-2 rounded-full bg-current" />{stockText}
          </p>

          <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-border bg-background/95 p-3 backdrop-blur md:static md:mt-6 md:border-0 md:bg-transparent md:p-0">
            <QtyStepper value={qty} label={p.name} onChange={(n) => setQty(Math.max(1, Math.min(n, v.stock || 1)))} />
            <Button variant="lux" size="xl" className="flex-1" disabled={v.stock === 0} onClick={() => add(p.id, v.id, qty)}>Add to bag</Button>
            <button onClick={() => toggleWish(p.id)} aria-pressed={wished} aria-label="Wishlist" className="grid size-12 shrink-0 place-items-center rounded-full border border-input">
              <Heart className={cn("size-5", wished && "fill-accent text-accent")} />
            </button>
          </div>
          <Button variant="luxOutline" size="xl" className="mt-3 hidden w-full md:flex" disabled={v.stock === 0} onClick={() => { add(p.id, v.id, qty); navigate({ to: "/checkout" }); }}>Buy now</Button>
          <Button variant="link" className="mt-1 w-full md:hidden" disabled={v.stock === 0} onClick={() => { add(p.id, v.id, qty); navigate({ to: "/checkout" }); }}>Buy now →</Button>

          <div className="mt-8 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 rounded-md bg-secondary p-3"><Truck className="size-4 text-primary" />Free shipping above ₹999</div>
            <div className="flex items-center gap-2 rounded-md bg-secondary p-3"><RotateCcw className="size-4 text-primary" />Returns per draft policy</div>
          </div>

          <Accordion type="multiple" defaultValue={["desc"]} className="mt-8">
            <AccordionItem value="desc"><AccordionTrigger className="font-serif text-xl font-normal">Description</AccordionTrigger><AccordionContent className="text-sm leading-relaxed text-muted-foreground">{p.description}</AccordionContent></AccordionItem>
            <AccordionItem value="ing"><AccordionTrigger className="font-serif text-xl font-normal">Ingredients</AccordionTrigger><AccordionContent className="text-sm text-muted-foreground">{p.ingredients.join(", ")}. <em>(Sample list — replace with the approved INCI list.)</em></AccordionContent></AccordionItem>
            <AccordionItem value="dir"><AccordionTrigger className="font-serif text-xl font-normal">Directions for use</AccordionTrigger><AccordionContent className="text-sm text-muted-foreground">{p.directions}</AccordionContent></AccordionItem>
            <AccordionItem value="info"><AccordionTrigger className="font-serif text-xl font-normal">Product information</AccordionTrigger><AccordionContent>
              <dl className="grid grid-cols-2 gap-2 text-sm">{p.details.map((d) => <div key={d.label} className="contents"><dt className="text-muted-foreground">{d.label}</dt><dd>{d.value}</dd></div>)}</dl>
            </AccordionContent></AccordionItem>
            <AccordionItem value="ship"><AccordionTrigger className="font-serif text-xl font-normal">Shipping & returns</AccordionTrigger><AccordionContent className="text-sm text-muted-foreground">Dispatch expected within 2–4 working days. Returns follow our <Link to="/refund-policy" className="underline">draft refund policy</Link>.</AccordionContent></AccordionItem>
          </Accordion>
        </div>
      </div>

      {related.length > 0 && (
        <section className="container-lux pb-24">
          <h2 className="mb-8 text-4xl">You may also like</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">{related.map((r, i) => <ProductCard key={r.id} product={r} index={i} />)}</div>
        </section>
      )}
    </>
  );
}
