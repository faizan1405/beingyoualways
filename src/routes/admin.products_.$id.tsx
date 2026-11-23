import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Eye, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminPage, Panel, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { ProductImageManager } from "@/components/admin/ProductImageManager";
import { ProductCard } from "@/components/shop/ProductCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAllProducts } from "@/hooks/use-demo-store";
import { inr } from "@/lib/format";
import { categories } from "@/lib/mock-data";
import { concerns as concernList, productConcerns } from "@/lib/concerns";
import type { Product, ProductVariant } from "@/lib/types";
import { productService, validateProduct } from "@/services/productService";
import { galleryImages, infographicImages, originalImages, withExtraImage } from "@/lib/product-images";
import { infographicFor } from "@/content/infographics";
import { isUnconfirmed } from "@/lib/variants";
import { PRODUCT_SHEET_SOURCE, claimFlagLabels, pendingPhotos, sheetFor } from "@/content/product-sheet";

const hint = "mt-1 text-[11px] text-muted-foreground";
const splitList = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

export const Route = createFileRoute("/admin/products_/$id")({ component: EditProduct });

const blank = (): Product => ({
  id: `p${Date.now()}`, slug: "", name: "", category: "skincare", shortDescription: "", description: "",
  ingredients: [], directions: "", details: [], shape: "bottle", tint: "oklch(0.8 0.05 140)", featured: false,
  status: "draft", isSample: true,
  // No invented facts: size, price and stock start empty until the client supplies them.
  variants: [{ id: `v${Date.now()}`, label: "", kind: "size", price: 0, stock: 0 }],
});

function EditProduct() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "product", id], queryFn: () => (isNew ? Promise.resolve(blank()) : productService.getById(id)) });
  const [p, setP] = useState<Product | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const all = useAllProducts();
  // Raw text so commas/new lines can be typed; parsed into a list on save.
  const [ingText, setIngText] = useState("");
  const [keyText, setKeyText] = useState("");
  const [benefitText, setBenefitText] = useState("");
  useEffect(() => { if (data) { setP(data); setIngText(data.ingredients.join(", ")); setKeyText((data.keyIngredients ?? []).join(", ")); setBenefitText((data.benefits ?? []).join("\n")); } }, [data]);

  const save = useMutation({
    mutationFn: (x: Product) => productService.save(x),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); toast(isNew ? "Product created (demo state)" : "Product saved (demo state)"); navigate({ to: "/admin/products" }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save the product"),
  });

  if (isLoading || !p) return isLoading ? <div className="h-96 animate-pulse rounded-xl bg-card" /> : <p>Product not found.</p>;

  const up = (patch: Partial<Product>) => setP({ ...p, ...patch });
  const sheet = sheetFor(p.slug);
  const pending = pendingPhotos.filter((x) => x.slug === p.slug);
  const originals = originalImages(p.slug);
  const fourSet = galleryImages(p.slug);
  const slides = infographicImages(p.slug);
  const info = infographicFor(p.slug);
  const upV = (i: number, patch: Partial<ProductVariant>) => up({ variants: p.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) });

  return (
    <AdminPage title={isNew ? "Add product" : `Edit: ${p.name}`} subtitle="Demo — saved in this browser only. Use Reset catalogue on the products list to restore the original products.">
      <form
        className="grid gap-4 xl:grid-cols-[1fr_340px]"
        onSubmit={(e) => {
          e.preventDefault();
          const next = { ...p, ingredients: splitList(ingText), keyIngredients: splitList(keyText), benefits: benefitText.split("\n").map((x) => x.trim()).filter(Boolean), slug: p.slug || p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") };
          const errors = validateProduct(next, all);
          if (errors.length) { toast.error(errors[0]!); return; }
          save.mutate(next);
        }}
      >
        <div className="space-y-4">
          <Panel title="Basic details">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><label htmlFor="pn" className={adminLabel}>Name</label><input id="pn" className={adminInput} value={p.name} onChange={(e) => up({ name: e.target.value })} /></div>
              <div><label htmlFor="pc" className={adminLabel}>Category</label>
                <select id="pc" className={adminInput} value={p.category} onChange={(e) => up({ category: e.target.value as Product["category"] })}>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>
              <div><label htmlFor="ps" className={adminLabel}>Visibility</label>
                <select id="ps" className={adminInput} value={p.status} onChange={(e) => up({ status: e.target.value as Product["status"] })}><option value="active">Visible in shop</option><option value="draft">Hidden — draft</option><option value="archived">Hidden — archived</option></select>
                <p className={hint}>{p.status === "active" ? "Shoppers can find and buy this product." : "Hidden from the shop, search and recommendations."}</p></div>
              <div className="sm:col-span-2"><label htmlFor="psd" className={adminLabel}>Short description</label><input id="psd" className={adminInput} value={p.shortDescription} onChange={(e) => up({ shortDescription: e.target.value })} /></div>
              <div className="sm:col-span-2"><label htmlFor="pd" className={adminLabel}>Description</label><textarea id="pd" rows={4} className={`${adminInput} h-auto py-2`} value={p.description} onChange={(e) => up({ description: e.target.value })} /></div>
              <div className="sm:col-span-2"><label htmlFor="pk" className={adminLabel}>Key ingredients</label><input id="pk" className={adminInput} value={keyText} placeholder="e.g. Mulberry Extract, Niacinamide 3%" onChange={(e) => setKeyText(e.target.value)} />
                <p className={hint}>The hero ingredients the brand names (product sheet or pack front). Not a full list.</p></div>
              <div className="sm:col-span-2"><label htmlFor="pi" className={adminLabel}>Full ingredients</label><textarea id="pi" rows={2} className={`${adminInput} h-auto py-2`} value={ingText} placeholder="Only as printed on the pack — e.g. Aloe vera, Rose water" onChange={(e) => setIngText(e.target.value)} />
                <p className={hint}>Separate with commas or new lines. Leave blank until the client confirms — blank sections stay hidden on the shop.</p></div>
              <div className="sm:col-span-2"><label htmlFor="pdir" className={adminLabel}>How to use</label><textarea id="pdir" rows={3} className={`${adminInput} h-auto py-2`} value={isUnconfirmed(p.directions) ? "" : p.directions} placeholder="Awaiting usage instructions from the client" onChange={(e) => up({ directions: e.target.value })} />
                <p className={hint}>Shown on the product page only once filled in.</p></div>
              <div className="sm:col-span-2"><label htmlFor="pb" className={adminLabel}>Benefits</label><textarea id="pb" rows={3} className={`${adminInput} h-auto py-2`} value={benefitText} placeholder="One benefit per line — only what the brand states for this product" onChange={(e) => setBenefitText(e.target.value)} />
                <p className={hint}>Shown as a “Benefits” section on the product page when filled in. Don't add results the client hasn't confirmed.</p></div>
              <div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!p.bestSeller} onChange={(e) => up({ bestSeller: e.target.checked })} /> Best Seller</label>
                <p className={hint}>Shows this product in the homepage Best Seller section (when visible in shop).</p></div>
              <div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.featured} onChange={(e) => up({ featured: e.target.checked })} /> Featured</label>
                <p className={hint}>Listed first when the shop is sorted by “Featured”.</p></div>
            </div>
          </Panel>
          <Panel title="Shop by concern">
            <p className="mb-3 text-xs text-muted-foreground">Only tick concerns the product's own description supports.</p>
            <div className="flex flex-wrap gap-2">
              {concernList.map((c) => {
                const current = p.concerns ?? productConcerns[p.slug] ?? [];
                const on = current.includes(c.slug);
                return (
                  <button key={c.slug} type="button" aria-pressed={on} onClick={() => up({ concerns: on ? current.filter((x) => x !== c.slug) : [...current, c.slug] })}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "border-input hover:border-primary"}`}>{c.name}</button>
                );
              })}
            </div>
          </Panel>
          <Panel title="Related products">
            <p className="mb-3 text-xs text-muted-foreground">Pick up to 4 products to show under “You may also like” on this product page. Leave empty to show more from the same category.</p>
            <div className="flex flex-wrap gap-2">
              {all.filter((x) => x.id !== p.id && x.status === "active").map((x) => {
                const cur = p.relatedSlugs ?? [];
                const on = cur.includes(x.slug);
                return (
                  <button key={x.id} type="button" aria-pressed={on} disabled={!on && cur.length >= 4} onClick={() => up({ relatedSlugs: on ? cur.filter((s) => s !== x.slug) : [...cur, x.slug] })}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${on ? "border-primary bg-primary text-primary-foreground" : "border-input hover:border-primary"}`}>{x.name}</button>
                );
              })}
            </div>
          </Panel>
          <Panel title="Sizes / shades, pricing & stock" action={<Button type="button" variant="outline" size="sm" onClick={() => up({ variants: [...p.variants, { id: `v${Date.now()}`, label: "", kind: p.variants[0]?.kind ?? "size", price: 0, stock: 0 }] })}><Plus /> Add size or shade</Button>}>
            <p className="mb-3 text-xs text-muted-foreground">Stock numbers are demo values, not real inventory. 0 shows “Currently unavailable”; any other number shows “Available to order” — counts are never shown to shoppers. Sizes labelled “to be confirmed” are hidden on the shop.</p>
            <div className="space-y-3">
              {p.variants.map((v, i) => (
                <div key={v.id} className="grid grid-cols-2 items-end gap-3 rounded-md bg-secondary/60 p-3 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
                  {v.kind === "shade" && (
                    <div className="col-span-2 flex items-center gap-2 sm:col-span-5"><label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" htmlFor={`vc${i}`}>Shade colour</label>
                      <input id={`vc${i}`} type="color" className="h-8 w-12 cursor-pointer rounded border border-input bg-card" value={/^#[0-9a-f]{6}$/i.test(v.swatch ?? "") ? v.swatch : "#c78e78"} onChange={(e) => upV(i, { swatch: e.target.value })} />
                      <span className="text-[11px] text-muted-foreground">{v.swatch ? "Shown as the shade chip" : "No chip colour set"}</span></div>
                  )}
                  <div className="col-span-2 sm:col-span-5"><label className={adminLabel} htmlFor={`vl${i}`}>{v.kind === "shade" ? "Shade name" : "Size"} <span className="ml-1 font-mono text-[10px] normal-case tracking-normal text-muted-foreground/80">ID {v.id}</span></label><input id={`vl${i}`} className={adminInput} value={v.label} onChange={(e) => upV(i, { label: e.target.value })} /></div>
                  <div><label className={adminLabel} htmlFor={`vk${i}`}>Type</label><select id={`vk${i}`} className={adminInput} value={v.kind} onChange={(e) => upV(i, { kind: e.target.value as "size" })}><option value="size">Size</option><option value="shade">Shade</option></select></div>
                  <div><label className={adminLabel} htmlFor={`vp${i}`}>Selling ₹</label><input id={`vp${i}`} type="number" min={0} className={adminInput} value={v.price} onChange={(e) => upV(i, { price: Number(e.target.value) })} /></div>
                  <div><label className={adminLabel} htmlFor={`vm${i}`}>MRP ₹</label><input id={`vm${i}`} type="number" min={0} className={adminInput} value={v.compareAtPrice ?? ""} onChange={(e) => upV(i, { compareAtPrice: e.target.value ? Number(e.target.value) : undefined })} /></div>
                  <div><label className={adminLabel} htmlFor={`vs${i}`}>Stock (demo)</label><input id={`vs${i}`} type="number" min={0} className={adminInput} value={v.stock} onChange={(e) => upV(i, { stock: Number(e.target.value) })} /></div>
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove this size or shade" disabled={p.variants.length === 1} onClick={() => up({ variants: p.variants.filter((_, j) => j !== i) })}><Trash2 /></Button>
                </div>
              ))}
            </div>
          </Panel>
          {sheet.length > 0 && (
            <Panel title="Client product sheet (reference)">
              <p className="mb-3 text-xs text-muted-foreground">From {PRODUCT_SHEET_SOURCE}. Shown here only — key ingredients and usage were copied to the product; flagged statements stay off the shop until the client sends proof.</p>
              {sheet.map((e) => (
                <div key={e.group} className="mb-3 last:mb-0">
                  <p className="text-sm font-semibold">{e.group}</p>
                  <ul className="mt-1.5 space-y-1 text-sm">
                    {e.points.map((pt) => (
                      <li key={pt.text} className="flex flex-wrap items-baseline gap-x-2">
                        <span>{pt.text}</span>
                        {pt.flag && <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent-foreground"><AlertTriangle className="size-3" aria-hidden />{claimFlagLabels[pt.flag]}</span>}
                      </li>
                    ))}
                  </ul>
                  {e.note && <p className="mt-2 rounded-md bg-secondary/60 p-2 text-xs text-muted-foreground">{e.note}</p>}
                </div>
              ))}
            </Panel>
          )}
        </div>
        <div className="space-y-4">
          <Panel title="Images · 4-slide gallery" action={<Button type="button" variant="outline" size="sm" onClick={() => setPreviewing(true)}><Eye /> Preview</Button>}>
            <ProductImageManager product={p} onChange={(images) => up({ images })} />
          </Panel>
          {pending.length > 0 && (
            <Panel title="Supplied photos awaiting confirmation">
              <p className="mb-3 text-xs text-muted-foreground">The client sent these, but they may be a different size or formula. They stay off the shop unless you add them here and save.</p>
              <div className="space-y-4">
                {pending.map((ph) => {
                  const used = p.images?.includes(ph.src);
                  return (
                    <figure key={ph.id} className="rounded-md border border-border p-3">
                      <img src={ph.src} alt={ph.label} className="aspect-[4/5] w-full rounded object-cover" loading="lazy" />
                      <figcaption className="mt-2 text-xs"><span className="block font-medium text-foreground">{ph.label}</span><span className="text-muted-foreground">{ph.reason}</span></figcaption>
                      <a href={ph.originalUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline">Full-size original <ExternalLink className="size-3" /></a>
                      {used ? <p className="mt-2 text-[11px] font-medium text-primary">In this product's gallery — press Save changes to keep it.</p> : (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => up({ images: withExtraImage(p.images, ph.src) })}>Add as extra</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => up({ images: [ph.src, ...(p.images ?? []).filter((x) => x !== ph.src)] })}>Use as main</Button>
                        </div>
                      )}
                    </figure>
                  );
                })}
              </div>
            </Panel>
          )}
          {info && slides.length === 4 && (
            <Panel title="Product infographics (4 slides)">
              <p className={`mb-3 rounded-md px-2.5 py-1.5 text-xs font-medium ${info.status === "ready" ? "bg-primary/10 text-primary" : "border border-accent/40 bg-accent/10 text-foreground"}`}>
                {info.status !== "draft" ? (p.status === "draft" ? "Slides ready — they appear once this product is published." : "Live — shoppers see these four slides.") : "Draft — not shown to shoppers. The shop keeps the previous photos until the missing information below is supplied."}
              </p>
              {info.guide === "general" && (
                <div className="mb-3 rounded-md border border-dashed border-accent px-2.5 py-2 text-xs">
                  <p className="font-semibold">Common category guide (client allowed)</p>
                  <p className="mt-1 text-muted-foreground">The pack's exact directions weren't available, so these How to use steps are the usual method for this kind of product. Replace them if the manufacturer's directions arrive.</p>
                  <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-muted-foreground">{info.steps.map((s) => <li key={s.title}><span className="font-medium text-foreground">{s.title}:</span> {s.text}</li>)}</ol>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {slides.map((src, i) => (
                  <a key={src} href={src} target="_blank" rel="noreferrer" className="overflow-hidden rounded border border-border hover:border-primary" title="Open full size">
                    <img src={src} alt={`Slide ${i + 1} of 4`} loading="lazy" className="aspect-square w-full object-cover" />
                  </a>
                ))}
              </div>
              {info.missing.length > 0 && (
                <div className="mt-3"><p className="text-xs font-semibold">{info.status === "draft" ? "Missing before it can go live" : "Still needed"}</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">{info.missing.map((m) => <li key={m}>{m}</li>)}</ul></div>
              )}
              {info.uncertain.length > 0 && (
                <div className="mt-3"><p className="text-xs font-semibold">Left off / to confirm</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">{info.uncertain.map((m) => <li key={m}>{m}</li>)}</ul></div>
              )}
              <details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer font-semibold text-foreground">Where the wording comes from</summary>
                <p className="mt-1">Who is it for: {info.sources.who}</p><p className="mt-1">What's inside: {info.sources.inside}</p><p className="mt-1">How to use: {info.sources.how}</p></details>
              {info.status !== "draft" && !slides.every((x, i) => p.images?.[i] === x) && (
                <Button type="button" size="sm" variant="outline" className="mt-3 w-full" onClick={() => { up({ images: [...slides] }); toast("Infographic slides restored — press Save changes to keep them"); }}>Use the four infographic slides</Button>
              )}
            </Panel>
          )}
          {originals.length > 0 && (
            <Panel title="Original photos (backup)">
              <p className="mb-3 text-xs text-muted-foreground">The earlier photos from beingyoualways.com are kept here. Add any back, or switch the whole gallery, then press Save changes.</p>
              <div className="grid grid-cols-4 gap-2">
                {originals.map((src, i) => {
                  const used = p.images?.includes(src);
                  return (
                    <button key={src} type="button" disabled={used} title={used ? "Already in the gallery" : "Add to the gallery"} onClick={() => up({ images: withExtraImage(p.images, src) })}
                      className={`relative overflow-hidden rounded border ${used ? "border-primary opacity-50" : "border-border hover:border-primary"}`}>
                      <img src={src} alt={`Original photo ${i + 1}`} loading="lazy" className="aspect-square w-full object-cover" />
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 grid gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => { up({ images: [...originals] }); toast("Original photos restored — press Save changes to keep them"); }}>Use original photos only</Button>
                {fourSet.length === 4 && <Button type="button" size="sm" variant="outline" onClick={() => { up({ images: [...fourSet] }); toast("Previous four-photo gallery restored — press Save changes to keep it"); }}>Use the previous four-photo gallery</Button>}
              </div>
            </Panel>
          )}
          <Button variant="lux" size="xl" className="w-full" type="submit" disabled={save.isPending}>{isNew ? "Create product" : "Save changes"}</Button>
          <Button variant="ghost" className="w-full" type="button" onClick={() => navigate({ to: "/admin/products" })}>Cancel</Button>
        </div>
      </form>
      <Dialog open={previewing} onOpenChange={setPreviewing}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="font-serif text-2xl">Shop preview</DialogTitle>
          <DialogDescription>How this card looks with your unsaved changes. {p.status === "active" ? "It's visible in the shop once saved." : "Hidden — shoppers won't see it until you set it to visible."}</DialogDescription>
          <div className="pointer-events-none"><ProductCard product={{ ...p, benefits: benefitText.split("\n").filter(Boolean) }} index={0} /></div>
          <p className="text-xs text-muted-foreground">From {inr(Math.min(...p.variants.map((v) => v.price)))} · {p.variants.length} size/shade option{p.variants.length === 1 ? "" : "s"}</p>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
