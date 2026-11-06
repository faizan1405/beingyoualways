import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, Check, ChevronRight, Circle, Mail, Phone } from "lucide-react";

import { ImageReveal, Parallax, RevealOnScroll, TextReveal } from "@/components/motion/Reveal";
import { contactConfig, policyLinks } from "@/config/business";
import { policies, policyChecklist, policyHero, policyReview, withHeadingIds, type PolicyKey } from "@/content/policies";

/** Renders a policy migrated verbatim from the original website. Text is static, trusted, script-free HTML from src/content. */
export function PolicyPage({ title, policy }: { title: string; policy: PolicyKey }) {
  const p = policies[policy];
  const review = policyReview[policy];
  const hero = policyHero[policy];
  const { html, toc } = withHeadingIds(p.html);

  return (
    <>
      <section className="relative isolate overflow-hidden bg-primary text-primary-foreground">
        <ImageReveal className="absolute inset-y-0 right-0 -z-10 w-full md:w-[62%]">
          <Parallax speed={-0.06} className="h-[120%] -translate-y-[8%]">
            {hero.image && <img src={hero.image} alt={hero.alt} fetchPriority="high" decoding="async" className="h-full w-full object-cover" style={{ objectPosition: hero.pos }} />}
          </Parallax>
        </ImageReveal>
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,var(--primary)_0%,color-mix(in_oklab,var(--primary)_92%,transparent)_38%,color-mix(in_oklab,var(--primary)_40%,transparent)_70%,transparent_100%)] max-md:bg-[linear-gradient(0deg,var(--primary)_10%,color-mix(in_oklab,var(--primary)_70%,transparent)_100%)]" />
        <div className="container-lux flex min-h-[220px] flex-col justify-end py-8 md:min-h-[320px] md:py-12">
          <nav aria-label="Breadcrumb" className="hero-in">
            <ol className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-primary-foreground/75">
              <li><Link to="/" className="hover:text-primary-foreground">Home</Link></li>
              <li aria-hidden><ChevronRight className="size-3" /></li>
              <li>Customer care</li>
              <li aria-hidden><ChevronRight className="size-3" /></li>
              <li aria-current="page" className="text-primary-foreground">{title}</li>
            </ol>
          </nav>
          <TextReveal as="h1" text={title} className="mt-4 text-[2.6rem] leading-none md:text-6xl" delay={120} />
          <p className="hero-in mt-3 max-w-md text-sm text-primary-foreground/85 md:text-[15px]" style={{ animationDelay: "380ms" }}>{hero.subtitle}</p>
        </div>
      </section>

      <div className="container-lux max-w-[920px] py-12 md:py-16">
        <RevealOnScroll kind="fade" className="flex flex-col gap-2 border-b border-border pb-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>Source: <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-foreground">{p.sourceUrl.replace("https://", "")}</a> · last updated there {p.sourceModified.slice(0, 10)}</span>
          {!review.legallyApproved && <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-secondary px-3 py-1 font-semibold text-foreground"><span className="size-1.5 rounded-full bg-accent" /> Draft · awaiting client review</span>}
        </RevealOnScroll>

        {review.flags.length > 0 && (
          <RevealOnScroll kind="fade-up" delay={80} className="mt-8 rounded-2xl border border-accent/40 bg-accent/10 p-5 md:p-6">
            <p className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="size-4 text-accent" /> Notes for client review — not part of the policy</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">{review.flags.map((f) => <li key={f}>{f}</li>)}</ul>
          </RevealOnScroll>
        )}

        {toc.length > 3 && (
          <RevealOnScroll kind="fade" as="nav" className="mt-8 rounded-2xl bg-secondary p-5 md:p-6">
            <p className="eyebrow">On this page</p>
            <ol className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              {toc.map((t, i) => <li key={t.id}><a href={`#${t.id}`} className="link-underline text-muted-foreground hover:text-foreground"><span className="mr-2 font-serif text-accent">{String(i + 1).padStart(2, "0")}</span>{t.text}</a></li>)}
            </ol>
          </RevealOnScroll>
        )}

        <RevealOnScroll kind="fade-up" delay={120}>
          <div
            className="policy-body mx-auto mt-10 max-w-[72ch] space-y-5 text-base leading-[1.85] text-foreground/85 [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a]:break-words [&_h2]:!mt-12 [&_h2]:scroll-mt-28 [&_h2]:border-t [&_h2]:border-border [&_h2]:pt-8 [&_h2]:font-serif [&_h2]:text-3xl [&_h2]:leading-tight [&_h2]:text-foreground [&_h2:first-child]:!mt-0 [&_h2:first-child]:border-0 [&_h2:first-child]:pt-0 [&_strong]:font-semibold [&_strong]:text-foreground"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </RevealOnScroll>

        <details className="mt-14 rounded-2xl border border-border p-5 text-sm">
          <summary className="cursor-pointer font-semibold">Internal review checklist</summary>
          <ul className="mt-3 space-y-1.5">
            {policyChecklist(policy).map((c) => (
              <li key={c.label} className="flex items-center gap-2">{c.done ? <Check className="size-4 text-primary" /> : <Circle className="size-4 text-muted-foreground" />}<span className={c.done ? "" : "text-muted-foreground"}>{c.label}</span></li>
            ))}
          </ul>
        </details>

        <nav aria-label="Other policies" className="mt-10 border-t border-border pt-8">
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
      </div>
    </>
  );
}
