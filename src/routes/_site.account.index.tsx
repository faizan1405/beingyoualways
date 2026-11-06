import { Link, createFileRoute } from "@tanstack/react-router";

import { OrderStatusBadge } from "@/components/shop/OrderBadges";
import { inr, shortDate } from "@/lib/format";
import { DEMO_CUSTOMER_ID, customerService } from "@/services/customerService";
import { orderService } from "@/services/orderService";

export const Route = createFileRoute("/_site/account/")({
  loader: async () => ({ customer: (await customerService.get(DEMO_CUSTOMER_ID))!, orders: await orderService.forCustomer(DEMO_CUSTOMER_ID) }),
  component: Dashboard,
});

function Dashboard() {
  const { customer, orders } = Route.useLoaderData();
  return (
    <div>
      <h2 className="text-3xl">Hello, {customer.name.split(" ")[0]}</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[["Orders", customer.orderCount], ["Total spent", inr(customer.totalSpent)], ["Member since", shortDate(customer.joinedAt)]].map(([k, v]) => (
          <div key={k} className="rounded-lg bg-secondary p-5"><p className="eyebrow">{k}</p><p className="mt-2 font-serif text-2xl">{v}</p></div>
        ))}
      </div>
      <h3 className="mt-10 text-2xl">Recent orders</h3>
      <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
        {orders.map((o) => (
          <li key={o.id}><Link to="/account/orders/$id" params={{ id: o.id }} className="flex items-center justify-between p-4 text-sm hover:bg-secondary/60">
            <span><span className="font-semibold">{o.id}</span> · {shortDate(o.createdAt)}</span>
            <span className="flex items-center gap-3"><OrderStatusBadge status={o.status} />{inr(o.total)}</span>
          </Link></li>
        ))}
      </ul>
    </div>
  );
}
