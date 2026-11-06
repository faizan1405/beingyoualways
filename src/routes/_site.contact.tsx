import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import { useState } from "react";

import { DemoNotice } from "@/components/shop/DemoNotice";
import { RevealOnScroll, TextReveal } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/button";
import { contactConfig, mapsUrl } from "@/config/business";

export const Route = createFileRoute("/_site/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us | Being You – Always" },
      { name: "description", content: "Call, email or visit Being You – Always in Vastral, Ahmedabad. We're here to help with products and your beauty routine." },
      { property: "og:title", content: "Contact Us | Being You – Always" },
      { property: "og:description", content: "Reach the Being You – Always team by phone, email or at our Ahmedabad office." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Contact,
});

const fields = [
  ["cname", "Name", "text", true],
  ["cemail", "Email", "email", true],
  ["cphone", "Phone", "tel", false],
  ["csubject", "Subject", "text", true],
] as const;

function Contact() {
  const [attempted, setAttempted] = useState(false);
  return (
    <>
      <section className="bg-secondary py-20 text-center md:py-28">
        <div className="container-lux max-w-3xl">
          <p className="eyebrow hero-in">Contact us</p>
          <TextReveal as="h1" text="We're Here for You." className="mt-4 text-5xl leading-tight md:text-7xl" delay={120} />
          <p className="hero-in mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-muted-foreground" style={{ animationDelay: "450ms" }}>
            Have a question about our products or your beauty routine? We'd love to hear from you. Reach out to our team and we'll help you find the information you need.
          </p>
        </div>
      </section>

      <section className="container-lux grid gap-12 py-16 md:grid-cols-[1fr_1.2fr] md:py-24">
        <RevealOnScroll kind="slide-right" className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-7">
            <Phone className="size-6 text-accent" strokeWidth={1.4} />
            <p className="mt-4 eyebrow">Call us</p>
            <ul className="mt-3 space-y-2">
              {contactConfig.phones.map((p) => (
                <li key={p.tel}><a href={`tel:${p.tel}`} className="font-serif text-2xl hover:text-accent">{p.display}</a> <span className="ml-1 text-xs text-muted-foreground">{p.label}</span></li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-7">
            <Mail className="size-6 text-accent" strokeWidth={1.4} />
            <p className="mt-4 eyebrow">Email</p>
            <a href={`mailto:${contactConfig.email}`} className="mt-3 block break-all font-serif text-2xl hover:text-accent">{contactConfig.email}</a>
          </div>
          <div className="rounded-2xl border border-border bg-card p-7">
            <MapPin className="size-6 text-accent" strokeWidth={1.4} />
            <p className="mt-4 eyebrow">Visit our office</p>
            <address className="mt-3 text-[15px] not-italic leading-relaxed">
              {contactConfig.addressLines.map((l) => <span key={l} className="block">{l}</span>)}
            </address>
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Open in Google Maps <ArrowUpRight className="size-4" /></a>
          </div>
        </RevealOnScroll>

        <RevealOnScroll kind="slide-left" delay={120} className="rounded-2xl border border-border bg-card p-7 md:p-10">
          <h2 className="text-4xl">Send us a message</h2>
          <form className="mt-8 space-y-4" onSubmit={(e) => { e.preventDefault(); setAttempted(true); }}>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map(([id, l, t, req]) => (
                <div key={id}>
                  <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider">{l}{!req && <span className="ml-1 font-normal normal-case text-muted-foreground">(optional)</span>}</label>
                  <input id={id} type={t} required={req} className="h-12 w-full rounded-md border border-input bg-background px-4 text-sm text-foreground outline-none focus:border-primary" />
                </div>
              ))}
            </div>
            <div>
              <label htmlFor="cmsg" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider">Message</label>
              <textarea id="cmsg" required rows={6} className="w-full rounded-md border border-input bg-background p-4 text-sm text-foreground outline-none focus:border-primary" />
            </div>
            <Button variant="lux" size="xl" type="submit">Send message</Button>
            {attempted ? (
              <DemoNotice>This form is in demo mode and your message was <strong>not sent</strong>. Please call or email us using the details on this page.</DemoNotice>
            ) : (
              <p className="text-xs text-muted-foreground">Demo form — messages are not delivered yet. For a reply, please call or email us.</p>
            )}
          </form>
        </RevealOnScroll>
      </section>
    </>
  );
}
