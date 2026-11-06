import { Link, createFileRoute, notFound } from "@tanstack/react-router";

import { OrderStatusBadge, PaymentBadge } from "@/components/shop/OrderBadges";
import { inr, shortDate } from "@/lib/format";
import { orderService } from "@/services/orderService";

export const Route = createFileRoute("/_site/account_/orders_/$id")({
  loader: async ({ params }) => {
    const o = await orderService.get(params.id);
    if (!o) throw notFound();
    return o;
  },
  head: ({ params }) => ({
    meta: [
      { title: `Order ${params.id} | Being You – Always` },
      { name: "description", content: "Order details (sample)." },
      { property: "og:title", content: `Order ${params.id}` },
      { property: "og:description", content: "Order details." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderDetail,
});

const steps = ["placed", "confirmed", "packed", "shipped", "delivered"] as const;

function OrderDetail() {
  const o = Route.useLoaderData();
  const idx = steps.indexOf(o.status as (typeof steps)[number]);
  return (
    <div className="container-lux max-w-3xl py-12">
      <Link to="/account/orders" className="text-xs text-muted-foreground hover:underline">← Back to orders</Link>
      <h1 className="mt-3 text-5xl">Order {o.id}</h1>
      <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">{shortDate(o.createdAt)} · <OrderStatusBadge status={o.status} /> <PaymentBadge status={o.paymentStatus} /> · Sample order</p>
      {o.status !== "cancelled" && (
        <ol className="mt-8 grid grid-cols-5 gap-1 text-center text-[10px] uppercase tracking-wider">
          {steps.map((s, i) => (
            <li key={s}><div className={`h-1 rounded-full ${i <= idx ? "bg-primary" : "bg-border"}`} /><span className={`mt-2 block ${i <= idx ? "text-foreground" : "text-muted-foreground"}`}>{s}</span></li>
          ))}
        </ol>
      )}
      <ul className="mt-10 divide-y divide-border border-y border-border">
        {o.items.map((i) => (
          <li key={i.variantId} className="flex justify-between py-4 text-sm"><span>{i.name} <span className="text-muted-foreground">· {i.variantLabel} × {i.quantity}</span></span><span>{inr(i.price * i.quantity)}</span></li>
        ))}
      </ul>
      <dl className="ml-auto mt-4 max-w-xs space-y-2 text-sm">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>{inr(o.subtotal)}</dd></div>
        <div className="flex justify-between"><dt>Shipping</dt><dd>{o.shipping ? inr(o.shipping) : "Free"}</dd></div>
        <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{inr(o.total)}</dd></div>
      </dl>
      <div className="mt-8 rounded-lg bg-secondary p-5 text-sm">
        <p className="eyebrow">Shipping to</p>
        <p className="mt-2">{o.shippingAddress.name}, {o.shippingAddress.line1}, {o.shippingAddress.city}, {o.shippingAddress.state} {o.shippingAddress.pincode}</p>
      </div>
    </div>
  );
}
