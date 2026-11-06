import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Youtube } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { RevealOnScroll, TextReveal } from "@/components/motion/Reveal";

export function Newsletter() {
  const [email, setEmail] = useState("");
  return (
    <section className="bg-secondary py-20">
      <div className="container-lux max-w-2xl text-center">
        <RevealOnScroll as="p" kind="fade" className="eyebrow">The Letter</RevealOnScroll>
        <TextReveal text="Slow rituals, in your inbox" className="mt-3 text-4xl md:text-5xl" />
        <p className="mt-3 text-sm text-muted-foreground">New launches, rituals and offers. Demo form — subscriptions are not stored yet.</p>
        <form
          className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!/^\S+@\S+\.\S+$/.test(email)) { toast.error("Please enter a valid email address"); return; }
            toast("Thanks! (Demo only — not saved until the backend is connected.)");
            setEmail("");
          }}
        >
          <label htmlFor="nl-email" className="sr-only">Email address</label>
          <input id="nl-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email address" className="h-12 flex-1 rounded-full border border-input bg-card px-5 text-sm outline-none focus:border-primary" />
          <button className="press h-12 rounded-full bg-primary px-7 text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground transition-shadow hover:shadow-lift">Subscribe</button>
        </form>
      </div>
    </section>
  );
}

const cols = [
  { title: "Shop", links: [["/shop", "Shop All"], ["/skincare", "Skincare"], ["/haircare", "Haircare"], ["/de-tan-care", "De-Tan Care"], ["/colour-cosmetics", "Colour Cosmetics"], ["/combos", "Combos"]] },
  { title: "Help", links: [["/faq", "FAQs"], ["/contact", "Contact Us"], ["/shipping-policy", "Shipping Policy"], ["/refund-policy", "Refund Policy"]] },
  { title: "Brand", links: [["/about", "About Us"], ["/login", "My Account"], ["/privacy-policy", "Privacy Policy"], ["/terms", "Terms & Conditions"]] },
] as const;

export function SiteFooter() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container-lux grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="font-serif text-3xl">Being You</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.42em] opacity-70">— Always —</p>
          <p className="mt-5 max-w-xs text-sm opacity-75">Plant-based skincare, haircare and colour, made for everyday rituals.</p>
          <div className="mt-6 flex gap-3">
            {[Instagram, Facebook, Youtube].map((I, i) => (
              <a key={i} href="#" aria-label="Social profile (placeholder)" className="press grid size-9 place-items-center rounded-full border border-primary-foreground/30 transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary-foreground/10"><I className="size-4" /></a>
            ))}
          </div>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="eyebrow !text-primary-foreground/60">{c.title}</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {c.links.map(([to, label]) => (
                <li key={to}><Link to={to} className="inline-block opacity-80 transition-[opacity,transform] duration-300 hover:translate-x-1 hover:opacity-100">{label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-primary-foreground/15">
        <div className="container-lux flex flex-col justify-between gap-2 py-5 text-xs opacity-70 md:flex-row">
          <span>© 2026 Being You – Always. Frontend prototype with sample content.</span>
          <Link to="/admin" className="hover:underline">Admin (demo)</Link>
        </div>
      </div>
    </footer>
  );
}
