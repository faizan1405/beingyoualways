import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Mail, Phone } from "lucide-react";

import { contactConfig, policyLinks } from "@/config/business";
import { policies, policyReview, type PolicyKey } from "@/content/policies";

/** Renders a policy migrated verbatim from the original website. Text is static, trusted, script-free HTML from src/content. */
export function PolicyPage({ title, policy }: { title: string; policy: PolicyKey }) {
  const p = policies[policy];
  const review = policyReview[policy];
  return (
    <article className="container-lux max-w-3xl py-16 md:py-24">
      <p className="eyebrow">Customer care</p>
      <h1 className="mt-3 text-5xl md:text-6xl">{title}</h1>
      <p className="mt-4 text-xs text-muted-foreground">
        Source: <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-foreground">{p.sourceUrl.replace("https://", "")}</a> · last updated there {p.sourceModified.slice(0, 10)}
        {!review.legallyApproved && <> · <span className="font-semibold text-accent">Awaiting client legal review</span></>}
      </p>

      <div
        className="policy-body mt-10 space-y-5 text-[15px] leading-[1.8] text-foreground/85 [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_h2]:!mt-12 [&_h2]:font-serif [&_h2]:text-3xl [&_h2]:text-foreground [&_strong]:font-semibold [&_strong]:text-foreground"
        dangerouslySetInnerHTML={{ __html: p.html }}
      />

      <nav aria-label="Other policies" className="mt-14 border-t border-border pt-8">
        <p className="eyebrow">All policies</p>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {policyLinks.map((l) => <li key={l.to}><Link to={l.to} className="link-underline text-muted-foreground hover:text-foreground" activeProps={{ className: "!text-primary font-semibold" }}>{l.label}</Link></li>)}
        </ul>
      </nav>

      <div className="mt-10 rounded-2xl bg-secondary p-6 text-sm md:p-8">
        <p className="font-serif text-2xl">Questions?</p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-muted-foreground">
          <a href={`tel:${contactConfig.phones[0].tel}`} className="inline-flex items-center gap-2 hover:text-foreground"><Phone className="size-4" />{contactConfig.phones[0].display}</a>
          <a href={`mailto:${contactConfig.email}`} className="inline-flex items-center gap-2 hover:text-foreground"><Mail className="size-4" />{contactConfig.email}</a>
          <Link to="/contact" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">Contact page <ArrowUpRight className="size-4" /></Link>
        </div>
      </div>
    </article>
  );
}
