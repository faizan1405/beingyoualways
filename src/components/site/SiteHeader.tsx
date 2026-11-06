import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useShop } from "@/lib/shop-store";

export const ANNOUNCEMENT = "Naturally you, beautifully always · Plant-based skin, hair & colour care";

const shopNav = [
  { to: "/shop", label: "Shop All" },
  { to: "/skincare", label: "Skin Care" },
  { to: "/haircare", label: "Hair Care" },
  { to: "/de-tan-care", label: "De-Tan Care" },
  { to: "/colour-cosmetics", label: "Colour Cosmetics" },
  { to: "/combos", label: "Combos" },
] as const;
const moreNav = [
  { to: "/about", label: "About Us" },
  { to: "/contact", label: "Contact Us" },
  { to: "/faq", label: "FAQs" },
] as const;

export function Wordmark({ className = "", compact = false }: { className?: string | undefined; compact?: boolean }) {
  return (
    <Link to="/" className={`flex shrink-0 flex-col items-start leading-none ${className}`} aria-label="Being You – Always, home">
      <span className={`font-serif tracking-wide transition-[font-size] duration-500 ${compact ? "text-xl md:text-2xl" : "text-2xl md:text-[1.7rem]"}`}>Being You</span>
      <span className="mt-0.5 pl-0.5 text-[9px] font-semibold uppercase tracking-[0.42em] text-muted-foreground">— Always —</span>
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
      <div className="bg-primary py-2 text-center text-[11px] font-medium tracking-[0.14em] text-primary-foreground">{ANNOUNCEMENT}</div>
      <header className={`sticky top-0 z-40 border-b backdrop-blur-md transition-[background-color,box-shadow,border-color] duration-500 ${scrolled ? "border-border/70 bg-background/95 shadow-soft" : "border-transparent bg-background/70"}`}>
        <div className={`container-lux flex items-center gap-4 transition-[height] duration-500 ${scrolled ? "h-14 md:h-16" : "h-16 md:h-20"}`}>
          <button className={`${iconBtn} -ml-2 lg:hidden`} aria-label="Open menu" onClick={() => setMenu(true)}>
            <Menu className="size-5" />
          </button>
          <Wordmark compact={scrolled} />

          <nav aria-label="Main" className="hidden min-w-0 flex-1 items-center justify-center gap-4 lg:flex xl:gap-7">
            {shopNav.map((n) => (
              <Link key={n.to} to={n.to} className="link-underline whitespace-nowrap py-2 text-[13px] font-medium text-foreground/80 transition-colors hover:text-primary" activeProps={{ className: "!text-primary" }}>
                {n.label}
              </Link>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger className="group flex items-center gap-1 whitespace-nowrap py-2 text-[13px] font-medium text-foreground/80 outline-none hover:text-primary focus-visible:text-primary">
                More <ChevronDown className="size-3.5 transition-transform duration-300 group-data-[state=open]:rotate-180" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="min-w-44">
                {moreNav.map((n) => (
                  <DropdownMenuItem key={n.to} asChild><Link to={n.to} className="cursor-pointer">{n.label}</Link></DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-0.5 lg:ml-0">
            <button className={iconBtn} aria-label={searching ? "Close search" : "Search"} aria-expanded={searching} onClick={() => setSearching((s) => !s)}>
              {searching ? <X className="size-5" /> : <Search className="size-5" />}
            </button>
            <Link to="/login" className={`${iconBtn} hidden sm:grid`} aria-label="Account"><User className="size-5" /></Link>
            <Link to="/wishlist" className={`${iconBtn} hidden sm:grid`} aria-label="Wishlist"><Heart className="size-5" /></Link>
            <button className={`${iconBtn} relative -mr-2`} aria-label={`Bag, ${count} items`} onClick={() => setDrawerOpen(true)}>
              <ShoppingBag className="size-5" />
              {count > 0 && <span key={bump} className="badge-bump absolute right-0.5 top-0.5 grid min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">{count}</span>}
            </button>
          </div>
        </div>
        {searching && (
          <form
            className="container-lux animate-in fade-in slide-in-from-top-2 pb-4 duration-300"
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
            <p className="eyebrow mb-1">Shop</p>
            {shopNav.map((n, i) => (
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
