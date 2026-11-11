import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminPage, Panel, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { ProductVisual } from "@/components/shop/ProductVisual";
import { Button } from "@/components/ui/button";
import { categories } from "@/lib/mock-data";
import { concerns as concernList, productConcerns } from "@/lib/concerns";
import type { Product, ProductVariant } from "@/lib/types";
import { productService } from "@/services/productService";
import { checkImageFile, fileToDemoImage } from "@/lib/image-upload";
import { withExtraImage, withMainImage } from "@/lib/product-images";
import { isUnconfirmed } from "@/lib/variants";

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
  const [preview, setPreview] = useState<string | null>(null);
  // Raw text so commas/new lines can be typed; parsed into a list on save.
  const [ingText, setIngText] = useState("");
  useEffect(() => { if (data) { setP(data); setIngText(data.ingredients.join(", ")); } }, [data]);

  const save = useMutation({
    mutationFn: (x: Product) => productService.save(x),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); toast(isNew ? "Product created (demo state)" : "Product saved (demo state)"); navigate({ to: "/admin/products" }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save the product"),
  });

  if (isLoading || !p) return isLoading ? <div className="h-96 animate-pulse rounded-xl bg-card" /> : <p>Product not found.</p>;

  const up = (patch: Partial<Product>) => setP({ ...p, ...patch });
  const upV = (i: number, patch: Partial<ProductVariant>) => up({ variants: p.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) });

  return (
    <AdminPage title={isNew ? "Add product" : `Edit: ${p.name}`} subtitle="Demo — saved in this browser only. Use Reset demo data on the products list to restore the original catalogue.">
      <form
        className="grid gap-4 xl:grid-cols-[1fr_340px]"
        onSubmit={(e) => {
          e.preventDefault();
          if (p.name.trim().length < 2) { toast.error("Product name is required"); return; }
          if (p.variants.some((v) => !v.label.trim() || v.price <= 0)) { toast.error("Each size or shade needs a label and a selling price"); return; }
          if (p.variants.some((v) => v.compareAtPrice != null && v.compareAtPrice <= v.price)) { toast.error("MRP must be higher than the selling price — or leave it blank"); return; }
          if (p.variants.some((v) => v.stock < 0 || !Number.isFinite(v.stock))) { toast.error("Stock can't be negative"); return; }
          save.mutate({ ...p, ingredients: splitList(ingText), slug: p.slug || p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") });
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
              <div className="sm:col-span-2"><label htmlFor="pi" className={adminLabel}>Ingredients</label><textarea id="pi" rows={2} className={`${adminInput} h-auto py-2`} value={ingText} placeholder="Only as printed on the pack — e.g. Aloe vera, Rose water" onChange={(e) => setIngText(e.target.value)} />
                <p className={hint}>Separate with commas or new lines. Leave blank until the client confirms — blank sections stay hidden on the shop.</p></div>
              <div className="sm:col-span-2"><label htmlFor="pdir" className={adminLabel}>How to use</label><textarea id="pdir" rows={3} className={`${adminInput} h-auto py-2`} value={isUnconfirmed(p.directions) ? "" : p.directions} placeholder="Awaiting usage instructions from the client" onChange={(e) => up({ directions: e.target.value })} />
                <p className={hint}>Shown on the product page only once filled in.</p></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.featured} onChange={(e) => up({ featured: e.target.checked })} /> Featured on homepage</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!p.bestSeller} onChange={(e) => up({ bestSeller: e.target.checked })} /> High demand</label>
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
                  <div className="col-span-2 sm:col-span-5"><label className={adminLabel} htmlFor={`vl${i}`}>{v.kind === "shade" ? "Shade name" : "Size"}</label><input id={`vl${i}`} className={adminInput} value={v.label} onChange={(e) => upV(i, { label: e.target.value })} /></div>
                  <div><label className={adminLabel} htmlFor={`vk${i}`}>Type</label><select id={`vk${i}`} className={adminInput} value={v.kind} onChange={(e) => upV(i, { kind: e.target.value as "size" })}><option value="size">Size</option><option value="shade">Shade</option></select></div>
                  <div><label className={adminLabel} htmlFor={`vp${i}`}>Selling ₹</label><input id={`vp${i}`} type="number" min={0} className={adminInput} value={v.price} onChange={(e) => upV(i, { price: Number(e.target.value) })} /></div>
                  <div><label className={adminLabel} htmlFor={`vm${i}`}>MRP ₹</label><input id={`vm${i}`} type="number" min={0} className={adminInput} value={v.compareAtPrice ?? ""} onChange={(e) => upV(i, { compareAtPrice: e.target.value ? Number(e.target.value) : undefined })} /></div>
                  <div><label className={adminLabel} htmlFor={`vs${i}`}>Stock (demo)</label><input id={`vs${i}`} type="number" min={0} className={adminInput} value={v.stock} onChange={(e) => upV(i, { stock: Number(e.target.value) })} /></div>
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove this size or shade" disabled={p.variants.length === 1} onClick={() => up({ variants: p.variants.filter((_, j) => j !== i) })}><Trash2 /></Button>
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Images">
            {preview ? <img src={preview} alt="Uploaded preview" className="aspect-[4/5] w-full rounded-md object-cover" /> : <ProductVisual src={p.images?.[0]} shape={p.shape} tint={p.tint} label={p.name || "New product"} className="rounded-md" />}
            {(p.images?.length ?? 0) > 1 && (
              <div className="mt-3 grid grid-cols-4 gap-2" aria-label="Choose main image">
                {p.images!.map((src, i) => (
                  <button key={src} type="button" title={i === 0 ? "Main image" : "Make main image"} onClick={() => { setPreview(null); up({ images: [src, ...p.images!.filter((x) => x !== src)] }); }}
                    className={`overflow-hidden rounded border ${i === 0 ? "border-primary ring-2 ring-primary" : "border-border"}`}>
                    <img src={src} alt="" className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {(p.images?.length ?? 0) > 1 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.images!.slice(1).map((src, i) => (
                  <button key={src} type="button" onClick={() => up({ images: p.images!.filter((x) => x !== src) })} className="inline-flex items-center gap-1 rounded-full border border-input px-2 py-0.5 text-[11px] text-muted-foreground hover:border-destructive hover:text-destructive"><X className="size-3" /> Remove photo {i + 2}</button>
                ))}
              </div>
            )}
            {preview ? (
              <div className="mt-3 grid gap-2" role="group" aria-label="Use the uploaded photo">
                <Button type="button" size="sm" onClick={() => { up({ images: withMainImage(p.images, preview) }); setPreview(null); toast("Main photo replaced — press Save changes to keep it"); }}>Replace main photo</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { up({ images: withExtraImage(p.images, preview) }); setPreview(null); toast("Photo added — press Save changes to keep it"); }}>Add as extra photo</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setPreview(null)}>Discard upload</Button>
              </div>
            ) : (
              <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input p-4 text-sm text-muted-foreground hover:border-primary">
                <Upload className="size-4" /> Upload new photo
                <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
                  const f = e.target.files?.[0]; e.target.value = "";
                  if (!f) return;
                  const bad = checkImageFile(f); if (bad) { toast.error(bad); return; }
                  try { setPreview(await fileToDemoImage(f)); } catch { toast.error("That image couldn't be read — try a JPG or PNG."); }
                }} />
              </label>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Demo: photos are saved in this browser only, until storage is connected. Replacing photos never changes the product ID, prices or sizes.</p>
          </Panel>
          <Button variant="lux" size="xl" className="w-full" type="submit" disabled={save.isPending}>{isNew ? "Create product" : "Save changes"}</Button>
          <Button variant="ghost" className="w-full" type="button" onClick={() => navigate({ to: "/admin/products" })}>Cancel</Button>
        </div>
      </form>
    </AdminPage>
  );
}
