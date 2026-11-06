import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminPage, Panel, Table, Td, adminInput } from "@/components/admin/AdminUI";
import { Pill } from "@/components/shop/OrderBadges";
import { ProductVisual } from "@/components/shop/ProductVisual";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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

  return (
    <AdminPage title="Products" subtitle="Changes are kept in memory for this demo and reset on reload."
      actions={<Button variant="lux" size="xl" asChild><Link to="/admin/products/$id" params={{ id: "new" }}><Plus /> Add product</Link></Button>}>
      <Panel>
        <input aria-label="Search products" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className={`${adminInput} mb-4 max-w-sm`} />
        {isLoading ? <div className="h-40 animate-pulse rounded bg-secondary" /> : (
          <Table head={["Product", "Category", "Price", "Stock", "Status", ""]}>
            {data.map((p) => {
              const stock = totalStock(p);
              return (
                <tr key={p.id}>
                  <Td><div className="flex items-center gap-3"><ProductVisual src={p.images?.[0]} shape={p.shape} tint={p.tint} label="" className="w-10 rounded" tag={false} /><span className="font-semibold">{p.name}</span></div></Td>
                  <Td>{categories.find((c) => c.slug === p.category)?.name}</Td>
                  <Td>{inr(minPrice(p))}</Td>
                  <Td><span className={stock === 0 ? "text-destructive" : stock < 10 ? "text-warning" : ""}>{stock}</span></Td>
                  <Td><Pill t={p.status === "active" ? "good" : p.status === "draft" ? "warn" : "muted"}>{p.status}</Pill></Td>
                  <Td className="text-right">
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
