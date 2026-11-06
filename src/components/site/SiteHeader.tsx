import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useState } from "react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useShop } from "@/lib/shop-store";

export const ANNOUNCEMENT = "Complimentary shipping on orders above ₹999 · Sample promotion";

const nav = [
  { to: "/", label: "Home" },
  { to: "/shop", label: "Shop All" },
  { to: "/skincare", label: "Skincare" },
  { to: "/haircare", label: "Haircare" },
  { to: "/colour-cosmetics", label: "Colour Cosmetics" },
  { to: "/about", label: "About Us" },
] as const;

export function Wordmark({ className = "" }: { className?: string | undefined}) {
  return (
    <Link to="/" className={`flex flex-col items-center leading-none ${className}`} aria-label="Being You – Always, home">
      <span className="font-serif text-2xl tracking-wide md:text-[1.7rem]">Being You</span>
      <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.42em] text-muted-foreground">— Always —</span>
    </Link>
  );
}

export function SiteHeader() {
  const { count, setDrawerOpen } = useShop();
  const [menu, setMenu] = useState(false);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  return (
    <>
      <div className="bg-primary py-2 text-center text-[11px] font-medium tracking-[0.14em] text-primary-foreground">{ANNOUNCEMENT}</div>
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-md">
        <div className="container-lux grid h-16 grid-cols-[1fr_auto_1fr] items-center md:h-20">
          <div className="flex items-center gap-1">
            <button className="grid size-10 place-items-center lg:hidden" aria-label="Open menu" onClick={() => setMenu(true)}>
              <Menu className="size-5" />
            </button>
            <nav aria-label="Main" className="hidden items-center gap-6 lg:flex">
              {nav.slice(1).map((n) => (
                <Link key={n.to} to={n.to} className="text-[13px] font-medium text-foreground/80 transition hover:text-primary" activeProps={{ className: "!text-primary underline underline-offset-8 decoration-accent" }}>
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <Wordmark />
          <div className="flex items-center justify-end gap-0.5">
            <button className="grid size-10 place-items-center" aria-label="Search" onClick={() => setSearching((s) => !s)}>
              {searching ? <X className="size-5" /> : <Search className="size-5" />}
            </button>
            <Link to="/login" className="hidden size-10 place-items-center sm:grid" aria-label="Account"><User className="size-5" /></Link>
            <Link to="/wishlist" className="hidden size-10 place-items-center sm:grid" aria-label="Wishlist"><Heart className="size-5" /></Link>
            <button className="relative grid size-10 place-items-center" aria-label={`Cart, ${count} items`} onClick={() => setDrawerOpen(true)}>
              <ShoppingBag className="size-5" />
              {count > 0 && <span className="absolute right-0.5 top-0.5 grid min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">{count}</span>}
            </button>
          </div>
        </div>
        {searching && (
          <form
            className="container-lux pb-4"
            onSubmit={(e) => { e.preventDefault(); setSearching(false); navigate({ to: "/shop", search: { q: q || undefined } }); }}
          >
            <label htmlFor="site-search" className="sr-only">Search products</label>
            <input id="site-search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search serums, oils, lipsticks…" className="h-12 w-full rounded-full border border-input bg-card px-5 text-sm outline-none focus:border-primary" />
          </form>
        )}
      </header>

      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="left" className="w-[86vw] max-w-sm bg-background">
          <SheetTitle className="font-serif text-2xl">Menu</SheetTitle>
          <nav aria-label="Mobile" className="mt-8 flex flex-col">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setMenu(false)} className="border-b border-border py-4 font-serif text-2xl">{n.label}</Link>
            ))}
            <Link to="/login" onClick={() => setMenu(false)} className="py-4 text-sm font-medium">Account</Link>
            <Link to="/wishlist" onClick={() => setMenu(false)} className="py-1 text-sm font-medium">Wishlist</Link>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
