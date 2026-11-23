import { useNavigate } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { adminInput, adminLabel } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAllProducts, useDemoStore } from "@/hooks/use-demo-store";
import { evaluateDiscount } from "@/lib/discounts";
import { inr } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";
import { customerStore } from "@/services/customerService";
import { discountStore } from "@/services/discountService";
import { orderService } from "@/services/orderService";

interface Line { productId: string; variantId: string; quantity: number }

/** Creates a clearly-marked demo order (never charged, never sent anywhere). */
export function NewOrderDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const customers = useDemoStore(customerStore).filter((c) => c.status === "active");
  const products = useAllProducts().filter((p) => p.status === "active" && p.variants.some((v) => v.price > 0));
  const discounts = useDemoStore(discountStore);
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [payment, setPayment] = useState<PaymentMethod>("razorpay");
  const [code, setCode] = useState("");

  const first = products[0];
  const addLine = () => first && setLines([...lines, { productId: first.id, variantId: first.variants[0]!.id, quantity: 1 }]);
  const priced = lines.map((l) => { const p = products.find((x) => x.id === l.productId); const v = p?.variants.find((x) => x.id === l.variantId); return { ...l, p, v }; });
  const subtotal = priced.reduce((s, l) => s + (l.v?.price ?? 0) * l.quantity, 0);
  const discount = discounts.find((d) => d.id === code);
  const check = discount ? evaluateDiscount(discount, subtotal) : null;

  const submit = async () => {
    const c = customers.find((x) => x.id === customerId);
    if (!c) { toast.error("Choose a customer."); return; }
    if (lines.length === 0) { toast.error("Add at least one product."); return; }
    if (lines.some((l) => !(l.quantity >= 1 && l.quantity <= 10))) { toast.error("Quantities must be between 1 and 10."); return; }
    try {
      const o = await orderService.create({
        customer: { id: c.id, name: c.name, email: c.email, phone: c.phone, address: c.addresses[0]! },
        lines, paymentMethod: payment, products, discount,
      });
      toast.success(`Demo order ${o.id} created — nothing was charged.`);
      onOpenChange(false); setLines([]); setCustomerId(""); setCode("");
      navigate({ to: "/admin/orders/$id", params: { id: o.id } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't create the order."); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-admin>
        <DialogTitle className="font-serif text-2xl">Create demo order</DialogTitle>
        <DialogDescription>For testing the workflow only. No payment is taken, no stock changes and the customer is not contacted.</DialogDescription>
        <div className="mt-2 space-y-4">
          <div><label htmlFor="no-c" className={adminLabel}>Customer (demo)</label>
            <select id="no-c" className={adminInput} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Choose…</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.addresses[0]?.city}</option>)}
            </select></div>
          <div className="space-y-2">
            <p className={adminLabel}>Products</p>
            {priced.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_70px_auto] items-end gap-2 rounded-md bg-secondary/60 p-2">
                <select aria-label="Product" className={adminInput} value={l.productId} onChange={(e) => { const p = products.find((x) => x.id === e.target.value)!; setLines(lines.map((x, j) => (j === i ? { ...x, productId: p.id, variantId: p.variants[0]!.id } : x))); }}>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select aria-label="Size or shade" className={adminInput} value={l.variantId} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, variantId: e.target.value } : x)))}>
                  {l.p?.variants.map((v) => <option key={v.id} value={v.id}>{v.label} · {inr(v.price)}</option>)}
                </select>
                <input aria-label="Quantity" type="number" min={1} max={10} className={adminInput} value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)))} />
                <Button type="button" variant="ghost" size="icon" aria-label="Remove line" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addLine} disabled={!first}><Plus /> Add product</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="no-p" className={adminLabel}>Payment method</label>
              <select id="no-p" className={adminInput} value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod)}><option value="razorpay">Razorpay (not connected — stays pending)</option><option value="cod">Cash on Delivery (rules pending)</option></select></div>
            <div><label htmlFor="no-d" className={adminLabel}>Discount code (optional)</label>
              <select id="no-d" className={adminInput} value={code} onChange={(e) => setCode(e.target.value)}><option value="">None</option>{discounts.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}</select>
              {check && !check.ok && <p className="mt-1 text-[11px] text-destructive">{check.reason}</p>}</div>
          </div>
          <dl className="ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{inr(subtotal)}</dd></div>
            {check?.ok && <div className="flex justify-between"><dt>Discount</dt><dd>− {inr(check.amount)}</dd></div>}
            <div className="flex justify-between text-muted-foreground"><dt>Shipping</dt><dd>Pending confirmation</dd></div>
            <div className="flex justify-between font-semibold"><dt>Total (before shipping)</dt><dd>{inr(subtotal - (check?.ok ? check.amount : 0))}</dd></div>
          </dl>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="lux" size="xl" onClick={submit}>Create demo order</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
