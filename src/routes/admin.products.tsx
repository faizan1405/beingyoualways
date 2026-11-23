import { Link, createFileRoute } from "@tanstack/react-router";
import { Copy, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminPage, Panel, Table, Td, adminInput } from "@/components/admin/AdminUI";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Pill } from "@/components/shop/OrderBadges";
import { ProductVisual } from "@/components/shop/ProductVisual";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAllProducts } from "@/hooks/use-demo-store";
import { LOW_STOCK_AT, isLowStock, isStockUncounted } from "@/lib/dashboard";
import { categories } from "@/lib/mock-data";
import { inr } from "@/lib/format";
import type { CategorySlug, Product, ProductStatus } from "@/lib/types";
import { minPrice, productService, totalStock } from "@/services/productService";
import { isBackendConfigured } from "@/services/api";

type Show = "low-stock" | "best-seller";
export const Route = createFileRoute("/admin/products")({
  validateSearch: (s: Record<string, unknown>): { show?: Show | undefined } => (s["show"] === "low-stock" || s["show"] === "best-seller" ? { show: s["show"] } : {}),
  component: Products,
});

const err = (e: unknown) => toast.error(e instanceof Error ? e.message : "Something went wrong");

function Products() {
  const all = useAllProducts();
  const { show } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<CategorySlug | "">("");
  const [vis, setVis] = useState<ProductStatus | "">("");
  const [del, setDel] = useState<Product | null>(null);
  const [resetting, setResetting] = useState(false);
  const live = isBackendConfigured();

  const data = [...all].sort((a, b) => a.name.localeCompare(b.name)).filter((p) =>
    (!q || `${p.name} ${p.slug} ${p.shortDescription}`.toLowerCase().includes(q.toLowerCase())) && (!cat || p.category === cat) && (!vis || p.status === vis) &&
    (show !== "low-stock" || isLowStock(p)) && (show !== "best-seller" || !!p.bestSeller));
  const marked = all.filter((p) => p.bestSeller && p.status === "active").length;

  const toggleBest = (p: Product, on: boolean) => productService.setHighDemand(p.id, on).then((x) => toast(x.bestSeller ? `${x.name} now shows in Best Seller` : `${x.name} removed from Best Seller`), err);
  const setStatus = (p: Product, status: ProductStatus) => productService.save({ ...p, status }).then(() => toast(status === "active" ? `${p.name} is now visible in the shop` : `${p.name} is hidden from the shop`), err);
  const duplicate = (p: Product) => productService.duplicate(p.id).then((c) => { toast(`Copied as a hidden draft: ${c.name}`); navigate({ to: "/admin/products/$id", params: { id: c.id } }); }, err);

  return (
    <AdminPage title="Products" subtitle={live ? "Saved in the store database. Changes show in the shop straight away; stock shows only after it has been counted." : "Real catalogue from beingyoualways.com. Demo edits are saved in this browser (they survive a refresh); stock numbers are demo values."}
      actions={<div className="flex flex-wrap gap-2">{!live && <Button variant="luxOutline" size="xl" onClick={() => setResetting(true)}><RotateCcw /> Reset catalogue</Button>}<Button variant="lux" size="xl" asChild><Link to="/admin/products/$id" params={{ id: "new" }}><Plus /> Add product</Link></Button></div>}>
      <Panel>
        <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input aria-label="Search products" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className={adminInput} />
          <select aria-label="Filter by category" className={adminInput} value={cat} onChange={(e) => setCat(e.target.value as CategorySlug)}><option value="">All categories</option>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
          <select aria-label="Filter by visibility" className={adminInput} value={vis} onChange={(e) => setVis(e.target.value as ProductStatus)}><option value="">Any visibility</option><option value="active">Visible in shop</option><option value="draft">Hidden — draft</option><option value="archived">Hidden — archived</option></select>
          <select aria-label="Quick filter" className={adminInput} value={show ?? ""} onChange={(e) => navigate({ search: e.target.value ? { show: e.target.value as Show } : {} })}><option value="">All products</option><option value="low-stock">Low stock (under {LOW_STOCK_AT})</option><option value="best-seller">Best Seller / High Demand</option></select>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">{marked} visible product{marked === 1 ? "" : "s"} marked Best Seller (High Demand) — they appear on the homepage. Showing {data.length} of {all.length}.</p>
        {data.length > 0 ? (
          <Table head={["Product", "Category", "Price", "Stock", "Visibility", "Best Seller", ""]}>
            {data.map((p) => {
              const stock = totalStock(p);
              return (
                <tr key={p.id}>
                  <Td><div className="flex items-center gap-3"><ProductVisual src={p.images?.[0]} shape={p.shape} tint={p.tint} label="" className="w-10 shrink-0 rounded" tag={false} /><Link to="/admin/products/$id" params={{ id: p.id }} className="font-semibold hover:underline">{p.name}</Link></div></Td>
                  <Td>{categories.find((c) => c.slug === p.category)?.name}</Td>
                  <Td>{minPrice(p) > 0 ? inr(minPrice(p)) : <span className="text-muted-foreground">No price</span>}</Td>
                  <Td>{isStockUncounted(p) ? <span className="text-xs text-muted-foreground">Not counted</span> : <span className={stock === 0 ? "text-destructive" : stock < LOW_STOCK_AT ? "text-warning" : ""}>{stock}</span>}</Td>
                  <Td>
                    <label className="sr-only" htmlFor={`vis-${p.id}`}>Visibility of {p.name}</label>
                    <select id={`vis-${p.id}`} className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={p.status} onChange={(e) => setStatus(p, e.target.value as ProductStatus)}>
                      <option value="active">Visible</option><option value="draft">Draft</option><option value="archived">Archived</option>
                    </select>
                  </Td>
                  <Td><Switch checked={!!p.bestSeller} onCheckedChange={(on) => toggleBest(p, on)} aria-label={`Show ${p.name} in Best Seller`} /></Td>
                  <Td className="whitespace-nowrap text-right">
                    <Button variant="ghost" size="icon" asChild aria-label={`Edit ${p.name}`}><Link to="/admin/products/$id" params={{ id: p.id }}><Pencil /></Link></Button>
                    <Button variant="ghost" size="icon" aria-label={`Duplicate ${p.name}`} onClick={() => duplicate(p)}><Copy /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Delete ${p.name}`} onClick={() => setDel(p)}><Trash2 className="text-destructive" /></Button>
                  </Td>
                </tr>
              );
            })}
          </Table>
        ) : <p className="py-10 text-center text-sm text-muted-foreground">No products match these filters.</p>}
        <p className="mt-3 text-[11px] text-muted-foreground"><Pill t="muted">Tip</Pill> Hidden products never appear in the shop, search, categories or recommendations.</p>
      </Panel>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={live ? `Archive ${del?.name ?? "product"}?` : `Delete ${del?.name ?? "product"}?`} confirmLabel={live ? "Archive" : "Delete"}
        description={live ? "It is hidden from the shop and kept in the database (so past orders still show it). You can make it visible again later." : "This removes it from the demo catalogue in this browser. Use Reset catalogue to bring the original products back."}
        onConfirm={() => del && productService.remove(del.id).then(() => toast(live ? `${del.name} archived — hidden from the shop` : "Product deleted (demo)"), err)} />
      <ConfirmDialog open={resetting} onOpenChange={setResetting} title="Reset the catalogue?" confirmLabel="Reset catalogue"
        description="All product edits, uploaded photos and new products saved in this browser are discarded and the imported catalogue is restored."
        onConfirm={() => productService.resetDemo().then(() => toast("Catalogue restored to the imported products"))} />
    </AdminPage>
  );
}
