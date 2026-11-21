import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { brandConfig, navigationConfig } from "@/config/business";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useShop } from "@/lib/shop-store";

const headerNav = navigationConfig.header;
const moreNav = [
  { to: "/explore-concerns", label: "Explore by Concern" },
  { to: "/contact", label: "Contact Us" },
  { to: "/faq", label: "FAQs" },
] as const;

export function Wordmark({ className = "", compact = false, tagline = false }: { className?: string | undefined; compact?: boolean; tagline?: boolean }) {
  return (
    <Link to="/" className={`flex shrink-0 flex-col items-center text-center leading-none ${className}`} aria-label="Being You – Always, home">
      <span className={`font-serif tracking-wide transition-[font-size] duration-500 ${compact ? "text-xl md:text-2xl" : "text-2xl md:text-[2rem]"}`}>Being You</span>
      <span className="mt-1 pl-[0.42em] text-[9px] font-semibold uppercase tracking-[0.42em] text-muted-foreground">— Always —</span>
      {tagline && (
        <span className={`hidden overflow-hidden whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.22em] text-accent transition-[max-height,opacity,margin] duration-500 sm:block ${compact ? "mt-0 max-h-0 opacity-0" : "mt-2 max-h-4 opacity-100"}`}>
          {brandConfig.headerTagline}
        </span>
      )}
    </Link>
  );
}

const iconBtn = "press grid size-11 place-items-center rounded-full transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SiteHeader() {
  const { count, setDrawerOpen } = useShop();
  const [menu, setMenu] = useState(false);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const [bump, setBump] = useState(0);
  const prev = useRef(count);
  useEffect(() => { if (count > prev.current) setBump((b) => b + 1); prev.current = count; }, [count]);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <>
      <header className={`sticky top-0 z-40 border-b bg-page transition-[box-shadow,border-color] duration-500 ${scrolled ? "border-border/70 shadow-soft" : "border-border/50"}`}>
        <div className={`container-lux grid grid-cols-[1fr_auto_1fr] items-center gap-2 transition-[padding] duration-500 ${scrolled ? "py-2" : "py-3 md:py-5"}`}>
          <div className="-ml-2 flex items-center gap-0.5">
            <button className={`${iconBtn} lg:hidden`} aria-label="Open menu" onClick={() => setMenu(true)}>
              <Menu className="size-5" />
            </button>
            <button className={iconBtn} aria-label={searching ? "Close search" : "Search"} aria-expanded={searching} onClick={() => setSearching((s) => !s)}>
              {searching ? <X className="size-5" /> : <Search className="size-5" />}
            </button>
            <Link to="/wishlist" className={`${iconBtn} hidden sm:grid`} aria-label="Wishlist"><Heart className="size-5" /></Link>
          </div>

          <Wordmark compact={scrolled} tagline />

          <div className="-mr-2 flex items-center justify-end gap-0.5">
            <Link to="/login" className={`${iconBtn} hidden sm:grid`} aria-label="Account"><User className="size-5" /></Link>
            <button className={`${iconBtn} relative`} aria-label={`Bag, ${count} items`} onClick={() => setDrawerOpen(true)}>
              <ShoppingBag className="size-5" />
              {count > 0 && <span key={bump} className="badge-bump absolute right-0.5 top-0.5 grid min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">{count}</span>}
            </button>
          </div>
        </div>

        <nav aria-label="Categories" className="hidden border-t border-border/50 lg:block">
          <ul className="container-lux flex items-center justify-center gap-10 xl:gap-14">
            {headerNav.map((n) => (
              <li key={n.to}>
                <Link to={n.to} className="link-underline block whitespace-nowrap py-3.5 text-[12px] font-semibold uppercase tracking-[0.18em] text-foreground/75 transition-colors hover:text-primary" activeProps={{ className: "!text-primary" }}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {searching && (
          <form
            className="container-lux animate-in fade-in slide-in-from-top-2 pb-4 pt-2 duration-300"
            onSubmit={(e) => { e.preventDefault(); setSearching(false); navigate({ to: "/shop", search: { q: q || undefined } }); }}
          >
            <label htmlFor="site-search" className="sr-only">Search products</label>
            <input id="site-search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search serums, oils, lipsticks…" className="h-12 w-full rounded-full border border-input bg-card px-5 text-sm outline-none focus:border-primary" />
          </form>
        )}
      </header>

      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="left" className="w-[86vw] max-w-sm overflow-y-auto bg-background">
          <SheetTitle className="font-serif text-2xl">Menu</SheetTitle>
          <nav aria-label="Mobile" className="mt-6 flex flex-col">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-accent">{brandConfig.headerTagline}</p>
            <p className="eyebrow mb-1 mt-6">Shop by category</p>
            {headerNav.map((n, i) => (
              <Link key={n.to} to={n.to} onClick={() => setMenu(false)} style={{ animationDelay: `${120 + i * 50}ms` }} className="animate-in fade-in slide-in-from-left-4 fill-mode-both border-b border-border py-3.5 font-serif text-2xl duration-500 active:text-accent">{n.label}</Link>
            ))}
            <p className="eyebrow mb-1 mt-8">Help & brand</p>
            {moreNav.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setMenu(false)} className="border-b border-border py-3 text-base font-medium">{n.label}</Link>
            ))}
            <div className="mt-6 grid grid-cols-2 gap-2">
              <Link to="/login" onClick={() => setMenu(false)} className="flex h-12 items-center justify-center gap-2 rounded-full border border-border text-sm font-medium"><User className="size-4" /> Account</Link>
              <Link to="/wishlist" onClick={() => setMenu(false)} className="flex h-12 items-center justify-center gap-2 rounded-full border border-border text-sm font-medium"><Heart className="size-4" /> Wishlist</Link>
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
