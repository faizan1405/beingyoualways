import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { DemoNotice } from "@/components/shop/DemoNotice";
import { buttonVariants } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/shop/OrderBadges";
import { inr, inrPaise, shortDate } from "@/lib/format";
import { DEMO_MODE, isBackendConfigured } from "@/services/api";
import { DEMO_CUSTOMER_ID, customerService } from "@/services/customerService";
import { customerAuthService, type ShopperAccount, type ShopperOrder } from "@/services/customerAuthService";
import { orderService } from "@/services/orderService";
import { whatsappShop } from "@/services/whatsappLiveService";
import { toast } from "sonner";

export const Route = createFileRoute("/_site/account/")({
  loader: async () => {
    // Signed-in state comes from a shopper cookie, so it is read in the browser, never during
    // server rendering (the server never sees the visitor's cookie).
    if (isBackendConfigured()) return { live: true as const, customer: null, orders: [] };
    // a real site without its store server shows "not connected" from the account layout — never sample data
    if (!DEMO_MODE) return { live: true as const, customer: null, orders: [] };
    return { live: false as const, customer: (await customerService.get(DEMO_CUSTOMER_ID))!, orders: await orderService.forCustomer(DEMO_CUSTOMER_ID) };
  },
  component: Dashboard,
});

function Dashboard() {
  const data = Route.useLoaderData();
  const [shopper, setShopper] = useState<ShopperAccount | null>(null);
  const [serverOrders, setServerOrders] = useState<ShopperOrder[]>([]);
  const [checking, setChecking] = useState(data.live);

  useEffect(() => {
    if (!data.live) return;
    let alive = true;
    void (async () => {
      const me = await customerAuthService.me();
      const r = me ? await customerAuthService.orders() : null;
      if (!alive) return;
      setShopper(me);
      setServerOrders(r?.ok ? r.orders : []);
      setChecking(false);
    })();
    return () => { alive = false; };
  }, [data.live]);

  if (data.live) {
    if (checking) return <p className="text-sm text-muted-foreground">Checking your account…</p>;
    if (!shopper) {
      return (
        <div>
          <h2 className="text-3xl">My account</h2>
          <DemoNotice className="mt-5">You are not signed in. Sign in with your email and password to see your orders and saved addresses.</DemoNotice>
          <div className="mt-6"><Link to="/login" className={buttonVariants({ variant: "lux", size: "lg" })}>Sign in</Link></div>
        </div>
      );
    }
    return (
      <div>
        <h2 className="text-3xl">Hello, {shopper.name.split(" ")[0]}</h2>
        {shopper.email && !shopper.emailVerified && (
          <DemoNotice className="mt-5">
            We haven't confirmed {shopper.email ?? "your email"} yet.{" "}
            <button
              type="button"
              className="underline"
              onClick={async () => {
                const r = await customerAuthService.resendVerification();
                if (!r.ok) return;
                const { toast } = await import("sonner");
                toast("Confirmation email sent again.");
              }}
            >
              Send the confirmation email again
            </button>
          </DemoNotice>
        )}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[["Orders", serverOrders.length], ["Email", shopper.emailVerified ? "Confirmed" : "Not confirmed"], ["Member since", shortDate(shopper.createdAt)]].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-secondary p-5"><p className="eyebrow">{k}</p><p className="mt-2 font-serif text-2xl">{v}</p></div>
          ))}
        </div>
        <h3 className="mt-10 text-2xl">Recent orders</h3>
        {serverOrders.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No orders on this account yet. Orders placed before you had an account can be added with the private link from the order page.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
            {serverOrders.slice(0, 5).map((o) => (
              <li key={o.orderNumber} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <span><span className="font-semibold">{o.orderNumber}</span> · {shortDate(o.createdAt)}</span>
                <span className="flex items-center gap-3">
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{o.statusLabel}</span>
                  <span className="font-semibold">{inrPaise(o.totals.totalPaise)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <WhatsAppPreferences />
      </div>
    );
  }

  const { customer, orders } = data;
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

/** The shopper's own WhatsApp choices, saved on the store server (STOP in WhatsApp also turns offers off). */
function WhatsAppPreferences() {
  const [prefs, setPrefs] = useState<{ orderUpdates: boolean; offers: boolean } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { whatsappShop.preferences().then(setPrefs).catch((e) => setNote(e instanceof Error ? e.message : "Can't load your WhatsApp choices.")); }, []);
  const save = async (p: { orderUpdates: boolean; offers: boolean }) => {
    setBusy(true);
    try { setPrefs(await whatsappShop.savePreferences(p)); toast("Saved"); } catch (e) { toast.error(e instanceof Error ? e.message : "Not saved."); } finally { setBusy(false); }
  };
  return (
    <section className="mt-10">
      <h3 className="text-2xl">WhatsApp messages</h3>
      {!prefs ? <p className="mt-3 text-sm text-muted-foreground">{note ?? "Loading…"}</p> : (
        <div className="mt-4 space-y-3 text-sm">
          <label className="flex items-start gap-2.5"><input type="checkbox" className="mt-1" checked={prefs.orderUpdates} disabled={busy} onChange={(e) => void save({ ...prefs, orderUpdates: e.target.checked })} /> Order updates (confirmation, shipping and delivery)</label>
          <label className="flex items-start gap-2.5"><input type="checkbox" className="mt-1" checked={prefs.offers} disabled={busy} onChange={(e) => void save({ ...prefs, offers: e.target.checked })} /> Offers and bag reminders</label>
          <p className="text-xs text-muted-foreground">You can also reply STOP on WhatsApp at any time.</p>
        </div>
      )}
    </section>
  );
}
