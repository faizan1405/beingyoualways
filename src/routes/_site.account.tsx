import { Link, Outlet, createFileRoute } from "@tanstack/react-router";

import { DemoNotice } from "@/components/shop/DemoNotice";

export const Route = createFileRoute("/_site/account")({
  head: () => ({
    meta: [
      { title: "My Account | Being You – Always" },
      { name: "description", content: "Manage your profile, addresses, orders and wishlist." },
      { property: "og:title", content: "My Account | Being You – Always" },
      { property: "og:description", content: "Your Being You – Always account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountLayout,
});

const tabs = [
  { to: "/account", label: "Dashboard", exact: true },
  { to: "/account/profile", label: "Profile" },
  { to: "/account/addresses", label: "Addresses" },
  { to: "/account/orders", label: "Orders" },
  { to: "/account/wishlist", label: "Wishlist" },
] as const;

function AccountLayout() {
  return (
    <div className="container-lux py-12">
      <h1 className="text-5xl">My Account</h1>
      <DemoNotice className="mt-5">Demo account with sample data. Secure sign-in will be added with the backend.</DemoNotice>
      <div className="mt-10 grid gap-10 md:grid-cols-[200px_1fr]">
        <nav aria-label="Account" className="-mx-1 flex gap-1 overflow-x-auto px-1 md:flex-col">
          {tabs.map((t) => (
            <Link key={t.to} to={t.to} activeOptions={{ exact: "exact" in t }} className="shrink-0 rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground md:rounded-md" activeProps={{ className: "!bg-secondary !text-foreground font-semibold" }}>{t.label}</Link>
          ))}
          <Link to="/login" className="shrink-0 px-4 py-2 text-sm text-muted-foreground">Sign out</Link>
        </nav>
        <div><Outlet /></div>
      </div>
    </div>
  );
}
