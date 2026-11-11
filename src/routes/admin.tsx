import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, Quote, BarChart3, Bot, Menu, MessageCircle, Package, Settings, ShoppingCart, Timer, Users, X } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard (Demo) | Being You – Always" },
      { name: "description", content: "Demo store administration for Being You – Always." },
      { property: "og:title", content: "Admin (Demo) | Being You – Always" },
      { property: "og:description", content: "Demo admin dashboard." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
});

const nav = [
  { to: "/admin", label: "Overview", I: BarChart3, exact: true },
  { to: "/admin/products", label: "Products", I: Package },
  { to: "/admin/orders", label: "Orders", I: ShoppingCart },
  { to: "/admin/customers", label: "Customers", I: Users },
  { to: "/admin/testimonials", label: "Customer Stories", I: Quote },
  { to: "/admin/whatsapp", label: "WhatsApp Marketing", I: MessageCircle },
  { to: "/admin/abandoned-cart", label: "Abandoned Cart", I: Timer },
  { to: "/admin/chatbot", label: "Chatbot", I: Bot },
  { to: "/admin/approvals", label: "Client Approvals", I: ClipboardCheck },
  { to: "/admin/settings", label: "Settings", I: Settings },
] as const;

function AdminLayout() {
  const [open, setOpen] = useState(false);
  const side = (
    <nav aria-label="Admin" className="flex flex-col gap-1 p-4">
      {nav.map(({ to, label, I, ...rest }) => (
        <Link key={to} to={to} onClick={() => setOpen(false)} activeOptions={{ exact: "exact" in rest }}
          className="flex items-center gap-3 rounded-md border-l-2 border-transparent px-3 py-2.5 text-sm text-sidebar-foreground/75 transition-all duration-200 hover:translate-x-0.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: "!bg-sidebar-accent !text-sidebar-accent-foreground !border-sidebar-primary font-semibold" }}>
          <I className="size-4" />{label}
        </Link>
      ))}
    </nav>
  );
  return (
    <div data-admin className="min-h-screen bg-secondary/50 lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="hidden bg-sidebar lg:sticky lg:top-0 lg:block lg:h-screen">
        <div className="border-b border-sidebar-border px-6 py-6 text-sidebar-foreground">
          <p className="font-serif text-2xl">Being You</p>
          <p className="text-[10px] uppercase tracking-[0.3em] opacity-60">Admin · Demo</p>
        </div>
        {side}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="animate-in fade-in absolute inset-0 bg-foreground/40 duration-300" onClick={() => setOpen(false)} />
          <aside className="animate-in slide-in-from-left relative h-full w-72 bg-sidebar duration-300">
            <button aria-label="Close menu" className="absolute right-3 top-4 text-sidebar-foreground" onClick={() => setOpen(false)}><X /></button>
            <p className="px-6 py-6 font-serif text-2xl text-sidebar-foreground">Being You</p>
            {side}
          </aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur md:px-8">
          <button className="lg:hidden" aria-label="Open admin menu" onClick={() => setOpen(true)}><Menu /></button>
          <p className="text-xs text-muted-foreground">UI demonstration only — admin is <strong>not secured</strong> until backend auth is added.</p>
          <Link to="/" className="hidden text-xs font-semibold text-primary hover:underline sm:block">View store →</Link>
        </header>
        <main className="p-4 md:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
