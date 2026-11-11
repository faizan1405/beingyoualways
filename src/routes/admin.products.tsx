import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminPage, Panel, Table, Td, adminInput } from "@/components/admin/AdminUI";
import { Pill } from "@/components/shop/OrderBadges";
import { ProductVisual } from "@/components/shop/ProductVisual";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { categories } from "@/lib/mock-data";
import { inr } from "@/lib/format";
import type { Product } from "@/lib/types";
import { minPrice, productService, totalStock } from "@/services/productService";

export const Route = createFileRoute("/admin/products")({ component: Products });

function Products() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [del, setDel] = useState<Product | null>(null);
  const { data = [], isLoading } = useQuery({ queryKey: ["admin", "products", q], queryFn: () => productService.list({ q, includeInactive: true, sort: "name" }) });
  const remove = useMutation({
    mutationFn: (id: string) => productService.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "products"] }); toast("Product deleted (demo state)"); },
  });

  const highDemand = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => productService.setHighDemand(id, on),
    onSuccess: (p) => { qc.invalidateQueries({ queryKey: ["admin", "products"] }); toast(p.bestSeller ? `${p.name} now shows in High Demand` : `${p.name} removed from High Demand`); },
    onError: (e: Error) => toast.error(e.message),
  });
  const marked = data.filter((p) => p.bestSeller).length;

  const reset = useMutation({
    mutationFn: () => productService.resetDemo(),
    onSuccess: () => { qc.invalidateQueries(); toast("Demo data reset to the imported catalogue"); },
  });

  return (
    <AdminPage title="Products" subtitle="Real catalogue from beingyoualways.com. Demo edits are saved in this browser only; stock numbers are demo values."
      actions={<div className="flex flex-wrap gap-2"><Button variant="luxOutline" size="xl" onClick={() => reset.mutate()}><RotateCcw /> Reset demo data</Button><Button variant="lux" size="xl" asChild><Link to="/admin/products/$id" params={{ id: "new" }}><Plus /> Add product</Link></Button></div>}>
      <Panel>
        <input aria-label="Search products" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className={`${adminInput} mb-2 max-w-sm`} />
        <p className="mb-4 text-xs text-muted-foreground">{marked} product{marked === 1 ? "" : "s"} in this list marked High Demand — they appear on the homepage (hidden products are skipped).</p>
        {isLoading ? <div className="h-40 animate-pulse rounded bg-secondary" /> : (
          <Table head={["Product", "Category", "Price", "Stock", "Status", "High Demand", ""]}>
            {data.map((p) => {
              const stock = totalStock(p);
              return (
                <tr key={p.id}>
                  <Td><div className="flex items-center gap-3"><ProductVisual src={p.images?.[0]} shape={p.shape} tint={p.tint} label="" className="w-10 rounded" tag={false} /><span className="font-semibold">{p.name}</span></div></Td>
                  <Td>{categories.find((c) => c.slug === p.category)?.name}</Td>
                  <Td>{inr(minPrice(p))}</Td>
                  <Td><span className={stock === 0 ? "text-destructive" : stock < 10 ? "text-warning" : ""}>{stock}</span></Td>
                  <Td><Pill t={p.status === "active" ? "good" : p.status === "draft" ? "warn" : "muted"}>{p.status}</Pill></Td>
                  <Td><Switch checked={!!p.bestSeller} disabled={highDemand.isPending} onCheckedChange={(on) => highDemand.mutate({ id: p.id, on })} aria-label={`Show ${p.name} in High Demand`} /></Td>
                  <Td className="whitespace-nowrap text-right">
                    <Button variant="ghost" size="icon" asChild aria-label={`Edit ${p.name}`}><Link to="/admin/products/$id" params={{ id: p.id }}><Pencil /></Link></Button>
                    <Button variant="ghost" size="icon" aria-label={`Delete ${p.name}`} onClick={() => setDel(p)}><Trash2 className="text-destructive" /></Button>
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
        {!isLoading && data.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No products found.</p>}
      </Panel>
      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {del?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This removes the product from the demo catalogue until you reload the page.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => del && remove.mutate(del.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  );
}
