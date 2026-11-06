import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminPage, Panel, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { ProductVisual } from "@/components/shop/ProductVisual";
import { Button } from "@/components/ui/button";
import { categories } from "@/lib/mock-data";
import { concerns as concernList, productConcerns } from "@/lib/concerns";
import type { Product, ProductVariant } from "@/lib/types";
import { productService } from "@/services/productService";

export const Route = createFileRoute("/admin/products_/$id")({ component: EditProduct });

const blank = (): Product => ({
  id: `p${Date.now()}`, slug: "", name: "", category: "skincare", shortDescription: "", description: "",
  ingredients: [], directions: "", details: [], shape: "bottle", tint: "oklch(0.8 0.05 140)", featured: false,
  status: "draft", isSample: true,
  variants: [{ id: `v${Date.now()}`, label: "50 ml", kind: "size", price: 499, stock: 0 }],
});

function EditProduct() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "product", id], queryFn: () => (isNew ? Promise.resolve(blank()) : productService.getById(id)) });
  const [p, setP] = useState<Product | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => { if (data) setP(data); }, [data]);

  const save = useMutation({
    mutationFn: (x: Product) => productService.save(x),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); toast(isNew ? "Product created (demo state)" : "Product saved (demo state)"); navigate({ to: "/admin/products" }); },
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
          if (p.variants.some((v) => !v.label || v.price <= 0)) { toast.error("Each variant needs a label and a price"); return; }
          save.mutate({ ...p, slug: p.slug || p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") });
        }}
      >
        <div className="space-y-4">
          <Panel title="Basic details">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><label htmlFor="pn" className={adminLabel}>Name</label><input id="pn" className={adminInput} value={p.name} onChange={(e) => up({ name: e.target.value })} /></div>
              <div><label htmlFor="pc" className={adminLabel}>Category</label>
                <select id="pc" className={adminInput} value={p.category} onChange={(e) => up({ category: e.target.value as Product["category"] })}>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>
              <div><label htmlFor="ps" className={adminLabel}>Status</label>
                <select id="ps" className={adminInput} value={p.status} onChange={(e) => up({ status: e.target.value as Product["status"] })}><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option></select></div>
              <div className="sm:col-span-2"><label htmlFor="psd" className={adminLabel}>Short description</label><input id="psd" className={adminInput} value={p.shortDescription} onChange={(e) => up({ shortDescription: e.target.value })} /></div>
              <div className="sm:col-span-2"><label htmlFor="pd" className={adminLabel}>Description</label><textarea id="pd" rows={4} className={`${adminInput} h-auto py-2`} value={p.description} onChange={(e) => up({ description: e.target.value })} /></div>
              <div className="sm:col-span-2"><label htmlFor="pi" className={adminLabel}>Ingredients (comma separated)</label><input id="pi" className={adminInput} value={p.ingredients.join(", ")} onChange={(e) => up({ ingredients: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></div>
              <div className="sm:col-span-2"><label htmlFor="pdir" className={adminLabel}>Directions for use</label><textarea id="pdir" rows={3} className={`${adminInput} h-auto py-2`} value={p.directions} onChange={(e) => up({ directions: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.featured} onChange={(e) => up({ featured: e.target.checked })} /> Featured on homepage</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!p.bestSeller} onChange={(e) => up({ bestSeller: e.target.checked })} /> Best seller</label>
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
          <Panel title="Variants, pricing & stock" action={<Button type="button" variant="outline" size="sm" onClick={() => up({ variants: [...p.variants, { id: `v${Date.now()}`, label: "", kind: p.variants[0]?.kind ?? "size", price: 0, stock: 0 }] })}><Plus /> Add variant</Button>}>
            <div className="space-y-3">
              {p.variants.map((v, i) => (
                <div key={v.id} className="grid grid-cols-2 items-end gap-3 rounded-md bg-secondary/60 p-3 sm:grid-cols-[1fr_100px_100px_100px_80px_auto]">
                  <div><label className={adminLabel} htmlFor={`vl${i}`}>Label</label><input id={`vl${i}`} className={adminInput} value={v.label} onChange={(e) => upV(i, { label: e.target.value })} /></div>
                  <div><label className={adminLabel} htmlFor={`vk${i}`}>Type</label><select id={`vk${i}`} className={adminInput} value={v.kind} onChange={(e) => upV(i, { kind: e.target.value as "size" })}><option value="size">Size</option><option value="shade">Shade</option></select></div>
                  <div><label className={adminLabel} htmlFor={`vp${i}`}>Selling ₹</label><input id={`vp${i}`} type="number" min={0} className={adminInput} value={v.price} onChange={(e) => upV(i, { price: Number(e.target.value) })} /></div>
                  <div><label className={adminLabel} htmlFor={`vm${i}`}>MRP ₹</label><input id={`vm${i}`} type="number" min={0} className={adminInput} value={v.compareAtPrice ?? ""} onChange={(e) => upV(i, { compareAtPrice: e.target.value ? Number(e.target.value) : undefined })} /></div>
                  <div><label className={adminLabel} htmlFor={`vs${i}`}>Stock</label><input id={`vs${i}`} type="number" min={0} className={adminInput} value={v.stock} onChange={(e) => upV(i, { stock: Number(e.target.value) })} /></div>
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove variant" disabled={p.variants.length === 1} onClick={() => up({ variants: p.variants.filter((_, j) => j !== i) })}><Trash2 /></Button>
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Images">
            {preview ? <img src={preview} alt="Uploaded preview" className="aspect-[4/5] w-full rounded-md object-cover" /> : <ProductVisual src={p.images?.[0]} shape={p.shape} tint={p.tint} label={p.name || "New product"} className="rounded-md" />}
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input p-4 text-sm text-muted-foreground hover:border-primary">
              <Upload className="size-4" /> Upload image (preview only)
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPreview(URL.createObjectURL(f)); }} />
            </label>
            <p className="mt-2 text-xs text-muted-foreground">Images are not uploaded until storage is connected.</p>
          </Panel>
          <Button variant="lux" size="xl" className="w-full" type="submit" disabled={save.isPending}>{isNew ? "Create product" : "Save changes"}</Button>
          <Button variant="ghost" className="w-full" type="button" onClick={() => navigate({ to: "/admin/products" })}>Cancel</Button>
        </div>
      </form>
    </AdminPage>
  );
}
