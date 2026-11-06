import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Mail, MapPin, Phone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { RevealOnScroll, TextReveal } from "@/components/motion/Reveal";
import { brandConfig, contactConfig, mapsUrl, navigationConfig, policyLinks } from "@/config/business";

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

const icons = { Instagram, Facebook } as const;

const cols = [
  { title: "Shop", links: [{ to: "/shop", label: "Shop All" }, ...navigationConfig.shop] },
  { title: "Information", links: navigationConfig.information },
  { title: "Customer Care", links: policyLinks },
];

export function SiteFooter() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container-lux grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.9fr_1.4fr]">
        <div>
          <p className="font-serif text-3xl">Being You</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.42em] opacity-70">— Always —</p>
          <p className="mt-5 max-w-xs text-sm leading-relaxed opacity-75">{brandConfig.shortDescription}</p>
          <p className="mt-3 font-serif text-lg italic opacity-90">{brandConfig.tagline}</p>
          <div className="mt-6 flex gap-3">
            {contactConfig.socials.map((s) => {
              const I = icons[s.label];
              return <a key={s.href} href={s.href} target="_blank" rel="noreferrer" aria-label={`Being You – Always on ${s.label}`} className="press grid size-9 place-items-center rounded-full border border-primary-foreground/30 transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary-foreground/10"><I className="size-4" /></a>;
            })}
          </div>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="eyebrow !text-primary-foreground/60">{c.title}</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {c.links.map((l) => (
                <li key={l.to}><Link to={l.to} className="inline-block opacity-80 transition-[opacity,transform] duration-300 hover:translate-x-1 hover:opacity-100">{l.label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <p className="eyebrow !text-primary-foreground/60">Connect</p>
          <ul className="mt-4 space-y-3 text-sm">
            {contactConfig.phones.map((p) => (
              <li key={p.tel}><a href={`tel:${p.tel}`} className="inline-flex items-center gap-2 opacity-85 hover:opacity-100"><Phone className="size-4 shrink-0" />{p.display}</a></li>
            ))}
            <li><a href={`mailto:${contactConfig.email}`} className="inline-flex items-center gap-2 break-all opacity-85 hover:opacity-100"><Mail className="size-4 shrink-0" />{contactConfig.email}</a></li>
            <li><a href={mapsUrl} target="_blank" rel="noreferrer" className="flex gap-2 opacity-85 hover:opacity-100"><MapPin className="mt-0.5 size-4 shrink-0" /><span>{contactConfig.addressLines.join(", ")}</span></a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-primary-foreground/15">
        <div className="container-lux flex flex-col justify-between gap-2 py-5 text-xs opacity-70 md:flex-row">
          <span>© {new Date().getFullYear()} Being You – Always. All rights reserved.</span>
          <Link to="/admin" className="hover:underline">Admin (demo)</Link>
        </div>
      </div>
    </footer>
  );
}
