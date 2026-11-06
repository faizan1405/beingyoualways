import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AdminPage, Panel, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { OrderStatusBadge, PaymentBadge } from "@/components/shop/OrderBadges";
import { inr, shortDate } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";
import { orderService } from "@/services/orderService";

export const Route = createFileRoute("/admin/orders_/$id")({ component: OrderAdmin });

function OrderAdmin() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: o, isLoading } = useQuery({ queryKey: ["admin", "order", id], queryFn: () => orderService.get(id) });
  const upd = useMutation({
    mutationFn: (s: OrderStatus) => orderService.updateStatus(id, s),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); toast("Status updated (demo — customer not notified)"); },
  });
  if (isLoading) return <div className="h-96 animate-pulse rounded-xl bg-card" />;
  if (!o) return <p>Order not found. <Link to="/admin/orders" className="underline">Back</Link></p>;

  return (
    <AdminPage title={`Order ${o.id}`} subtitle={`${shortDate(o.createdAt)} · sample order`}>
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Panel title="Items">
          <ul className="divide-y divide-border text-sm">
            {o.items.map((i) => <li key={i.variantId} className="flex justify-between py-3"><span>{i.name} · {i.variantLabel} × {i.quantity}</span><span>{inr(i.price * i.quantity)}</span></li>)}
          </ul>
          <dl className="ml-auto mt-4 max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{inr(o.subtotal)}</dd></div>
            <div className="flex justify-between"><dt>Shipping</dt><dd>{inr(o.shipping)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{inr(o.total)}</dd></div>
          </dl>
        </Panel>
        <div className="space-y-4">
          <Panel title="Status">
            <div className="mb-4 flex gap-2"><OrderStatusBadge status={o.status} /><PaymentBadge status={o.paymentStatus} /></div>
            <label htmlFor="os" className={adminLabel}>Update order status</label>
            <select id="os" className={adminInput} value={o.status} onChange={(e) => upd.mutate(e.target.value as OrderStatus)}>
              {["placed", "confirmed", "packed", "shipped", "delivered", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <p className="mt-2 text-xs text-muted-foreground">Payment method: {o.paymentMethod === "cod" ? "Cash on Delivery" : "Razorpay"} (not connected)</p>
          </Panel>
          <Panel title="Customer">
            <p className="text-sm font-semibold">{o.customerName}</p>
            <p className="mt-1 text-sm text-muted-foreground">{o.shippingAddress.line1}, {o.shippingAddress.city}, {o.shippingAddress.state} {o.shippingAddress.pincode}</p>
            <Link to="/admin/customers/$id" params={{ id: o.customerId }} className="mt-3 inline-block text-xs text-primary hover:underline">View customer →</Link>
          </Panel>
        </div>
      </div>
    </AdminPage>
  );
}
