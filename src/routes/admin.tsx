import { Link, Outlet, createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { ClipboardCheck, CloudOff, PlugZap, Quote, BarChart3, Bot, LayoutTemplate, LogOut, Menu, MessageCircle, Package, Settings, ShoppingCart, Tag, Timer, Users, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { adminAuthService, type AdminSession } from "@/services/adminAuthService";
import { isBackendConfigured, isLiveAdminPath, isUnconnectedProduction } from "@/services/api";
import { StoreNotConnected } from "@/components/admin/StoreNotConnected";
import { productService } from "@/services/productService";

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
  { to: "/admin/whatsapp-api", label: "WhatsApp Connection", I: PlugZap },
  { to: "/admin/whatsapp", label: "WhatsApp Marketing", I: MessageCircle },
  { to: "/admin/abandoned-cart", label: "Abandoned Cart", I: Timer },
  { to: "/admin/chatbot", label: "Chatbot", I: Bot },
  { to: "/admin/content", label: "Website Content", I: LayoutTemplate },
  { to: "/admin/discounts", label: "Discounts", I: Tag },
  { to: "/admin/approvals", label: "Client Approvals", I: ClipboardCheck },
  { to: "/admin/settings", label: "Settings", I: Settings },
] as const;

function AdminLayout() {
  return isUnconnectedProduction() ? <StoreNotConnected /> : <AdminShell />;
}

function AdminShell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const live = isBackendConfigured();
  // Demo: a convenience gate (not security). Live: the server confirms the session, and
  // every admin API call is checked again on the server.
  const [session, setSession] = useState<AdminSession | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setProblem(null);
    (async () => {
      try {
        const s = await adminAuthService.check();
        if (cancelled) return;
        if (!s) { navigate({ to: "/admin/login", replace: true }); return; }
        if (live) await productService.loadAdmin();
        if (!cancelled) setSession(s);
      } catch (e) {
        if (!cancelled) setProblem(e instanceof Error ? e.message : "Can't reach the store server.");
      }
    })();
    return () => { cancelled = true; };
  }, [navigate, live, attempt]);
  const signOut = async () => { await adminAuthService.signOut(); productService.clearAdmin(); navigate({ to: "/admin/login" }); };
  const side = (
    <nav aria-label="Admin" className="flex flex-col gap-1 p-4">
      {nav.map(({ to, label, I, ...rest }) => (
        <Link key={to} to={to} onClick={() => setOpen(false)} activeOptions={{ exact: "exact" in rest }}
          className="flex items-center gap-3 rounded-md border-l-2 border-transparent px-3 py-2.5 text-sm text-sidebar-foreground/75 transition-all duration-200 hover:translate-x-0.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: "!bg-sidebar-accent !text-sidebar-accent-foreground !border-sidebar-primary font-semibold" }}>
          <I className="size-4" />{label}
          {live && !isLiveAdminPath(to) && <span className="ml-auto rounded border border-sidebar-border px-1.5 py-0.5 text-[9px] uppercase tracking-wider opacity-60">Later</span>}
        </Link>
      ))}
    </nav>
  );
  if (problem) return (
    <div data-admin className="grid min-h-screen place-items-center bg-secondary/50 p-4">
      <div role="alert" className="max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-soft">
        <CloudOff className="mx-auto size-8 text-destructive" />
        <p className="mt-3 font-serif text-2xl">Store server unavailable</p>
        <p className="mt-2 text-sm text-muted-foreground">{problem}</p>
        <Button className="mt-5" variant="lux" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
      </div>
    </div>
  );
  if (!session) return <div data-admin className="grid min-h-screen place-items-center bg-secondary/50 text-sm text-muted-foreground">Opening admin…</div>;
  return (
    <div data-admin className="min-h-screen bg-secondary/50 lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="hidden bg-sidebar lg:sticky lg:top-0 lg:block lg:h-screen">
        <div className="border-b border-sidebar-border px-6 py-6 text-sidebar-foreground">
          <p className="font-serif text-2xl">Being You</p>
          <p className="text-[10px] uppercase tracking-[0.3em] opacity-60">{live ? "Admin" : "Admin · Demo"}</p>
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
          {live
            ? <p className="min-w-0 px-2 text-xs text-muted-foreground">Signed in as <strong>{session.name ?? session.email}</strong> · changes are saved to the store database.</p>
            : <p className="min-w-0 px-2 text-xs text-muted-foreground">Demo mode only — admin is <strong>not secured</strong> until server sign-in is added.</p>}
          <div className="flex items-center gap-4">
            <Link to="/" className="hidden text-xs font-semibold text-primary hover:underline sm:block">View store →</Link>
            <button type="button" onClick={() => void signOut()} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><LogOut className="size-3.5" /> {live ? "Sign out" : "Exit demo"}</button>
          </div>
        </header>
        <main className="p-4 md:p-8">{live && !isLiveAdminPath(pathname) ? <NotConnectedYet /> : <Outlet />}</main>
      </div>
    </div>
  );
}

/** Live mode: admin areas without a real database connection stay switched off (no demo figures). */
function NotConnectedYet() {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-8 text-center shadow-soft">
      <CloudOff className="mx-auto size-8 text-muted-foreground" />
      <h1 className="mt-3 font-serif text-3xl">Not connected yet</h1>
      <p className="mt-2 text-sm text-muted-foreground">This area will read real store data once it is connected to the database in a later phase. Until then it stays switched off, so no sample data or figures are shown.</p>
      <Button className="mt-5" variant="lux" asChild><Link to="/admin/products">Go to Products</Link></Button>
    </div>
  );
}
