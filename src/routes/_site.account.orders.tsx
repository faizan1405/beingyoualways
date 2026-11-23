import { Link, createFileRoute } from "@tanstack/react-router";

import { DemoNotice } from "@/components/shop/DemoNotice";
import { OrderStatusBadge } from "@/components/shop/OrderBadges";
import { inr, inrPaise, shortDate } from "@/lib/format";
import { DEMO_MODE, isBackendConfigured } from "@/services/api";
import { DEMO_CUSTOMER_ID } from "@/services/customerService";
import { customerAuthService } from "@/services/customerAuthService";
import { orderService } from "@/services/orderService";

export const Route = createFileRoute("/_site/account/orders")({
  // the shopper cookie only exists in the browser, so this page loads its data there, never during server rendering
  ssr: false,
  loader: async () => {
    if (isBackendConfigured()) {
      const r = await customerAuthService.orders();
      return { live: true as const, demoOrders: [], error: r.ok ? null : r.error, serverOrders: r.ok ? r.orders : [] };
    }
    if (!DEMO_MODE) return { live: false as const, demoOrders: [], error: null, serverOrders: [] }; // never sample data outside the preview
    return { live: false as const, demoOrders: await orderService.forCustomer(DEMO_CUSTOMER_ID), error: null, serverOrders: [] };
  },
  component: Orders,
});

function Orders() {
  const { live, demoOrders, serverOrders, error } = Route.useLoaderData();

  if (live) {
    return (
      <div>
        <h2 className="text-3xl">Order history</h2>
        {error && <DemoNotice className="mt-5">{error}</DemoNotice>}
        {!error && serverOrders.length === 0 && <p className="mt-5 text-sm text-muted-foreground">No orders on this account yet. Orders placed before you had an account can be added with the private link from the order page.</p>}
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border">
          {serverOrders.map((o) => (
            <li key={o.orderNumber} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
              <span><span className="font-semibold">{o.orderNumber}</span> · {shortDate(o.createdAt)} · {o.items.length} item{o.items.length === 1 ? "" : "s"}</span>
              <span className="flex items-center gap-3">
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{o.statusLabel}</span>
                <span className="font-semibold">{inrPaise(o.totals.totalPaise)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl">Order history</h2>
      <div className="mt-6 space-y-4">
        {demoOrders.map((o) => (
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
