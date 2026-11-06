import { Link, createFileRoute } from "@tanstack/react-router";

import { OrderStatusBadge } from "@/components/shop/OrderBadges";
import { inr, shortDate } from "@/lib/format";
import { DEMO_CUSTOMER_ID } from "@/services/customerService";
import { orderService } from "@/services/orderService";

export const Route = createFileRoute("/_site/account/orders")({
  loader: () => orderService.forCustomer(DEMO_CUSTOMER_ID),
  component: Orders,
});

function Orders() {
  const orders = Route.useLoaderData();
  return (
    <div>
      <h2 className="text-3xl">Order history</h2>
      <div className="mt-6 space-y-4">
        {orders.map((o) => (
          <Link key={o.id} to="/account/orders/$id" params={{ id: o.id }} className="block rounded-lg border border-border p-5 transition hover:shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{o.id}</span><OrderStatusBadge status={o.status} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{shortDate(o.createdAt)} · {o.items.length} items · {inr(o.total)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
