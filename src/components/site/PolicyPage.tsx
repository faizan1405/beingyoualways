import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Mail, Phone } from "lucide-react";
import type { ReactNode } from "react";

import { brandConfig, contactConfig } from "@/config/business";

/** Policy page shell: never shows invented terms — status stays "Pending Client Approval" until real text arrives. */
export function PolicyPage({ title, originalPath, children }: { title: string; originalPath: string; children?: ReactNode }) {
  return (
    <article className="container-lux max-w-3xl py-16 md:py-24">
      <p className="eyebrow hero-in">Customer care</p>
      <h1 className="hero-in mt-3 text-5xl md:text-6xl" style={{ animationDelay: "100ms" }}>{title}</h1>
      <div className="hero-in mt-8 rounded-2xl border border-border bg-secondary p-6" style={{ animationDelay: "200ms" }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Status · Pending client approval</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The final wording of this policy is being reviewed with Being You – Always. Until it is approved, please refer to the policy on the current website or contact our team.
        </p>
        <a href={`${brandConfig.originalWebsite.replace(/\/$/, "")}${originalPath}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline">
          View current policy <ArrowUpRight className="size-4" />
        </a>
      </div>
      {children && <div className="mt-10 space-y-5 text-[15px] leading-relaxed text-muted-foreground [&_h2]:mt-10 [&_h2]:text-3xl [&_h2]:text-foreground">{children}</div>}
      <div className="mt-12 border-t border-border pt-8 text-sm">
        <p className="font-serif text-2xl">Questions?</p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-muted-foreground">
          <a href={`tel:${contactConfig.phones[0].tel}`} className="inline-flex items-center gap-2 hover:text-foreground"><Phone className="size-4" />{contactConfig.phones[0].display}</a>
          <a href={`mailto:${contactConfig.email}`} className="inline-flex items-center gap-2 hover:text-foreground"><Mail className="size-4" />{contactConfig.email}</a>
          <Link to="/contact" className="font-semibold text-primary hover:underline">Contact page</Link>
        </div>
      </div>
    </article>
  );
}
