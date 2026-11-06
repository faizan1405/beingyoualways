import { useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MessageSquareQuote, Quote, Star } from "lucide-react";

import { RevealOnScroll, TextReveal } from "@/components/motion/Reveal";
import { testimonialCategories, testimonialService, type TestimonialCategory } from "@/services/testimonialService";


/** Public customer stories. Shows only verified, consented, published entries — never placeholder copy. */
export function Testimonials() {
  const all = useSyncExternalStore(testimonialService.subscribe, testimonialService.all, testimonialService.all);
  const list = all.filter((t) => t.verified && t.consent && t.published);
  const tabs = testimonialCategories.filter((c) => list.some((t) => t.category === c));
  const [picked, setTab] = useState<TestimonialCategory>("Skin");
  const tab = tabs.includes(picked) ? picked : (tabs[0] ?? picked);
  const items = list.filter((t) => t.category === tab);

  return (
    <section className="bg-secondary">
      <div className="container-lux py-20 md:py-28">
        <div className="text-center">
          <RevealOnScroll as="p" kind="fade" className="eyebrow">Customer stories</RevealOnScroll>
          <TextReveal text="In their own words" className="mt-3 text-4xl md:text-5xl" delay={80} />
          <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">Only verified reviews shared with the customer's permission appear here.</p>
        </div>
        {list.length === 0 ? (
          <div className="mx-auto mt-10 max-w-md rounded-2xl border border-dashed border-border bg-card px-8 py-12 text-center">
            <MessageSquareQuote className="mx-auto size-7 text-accent" strokeWidth={1.4} />
            <p className="mt-4 font-serif text-2xl">Customer stories are on their way</p>
            <p className="mt-2 text-sm text-muted-foreground">We'll share skin, hair and de-tan stories here once customers have given permission.</p>
          </div>
        ) : (<>
        <div role="tablist" aria-label="Story categories" className="mx-auto mt-10 flex max-w-full gap-2 overflow-x-auto pb-2 md:justify-center">
          {tabs.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`press shrink-0 rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${tab === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:border-primary"}`}>
              {t}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={tab} role="tabpanel" aria-label={tab} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }} className="mt-10">
            {items.length ? (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {items.map((s) => (
                  <figure key={s.id} className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
                    {s.photo && <img src={s.photo} alt={`${s.name}, customer`} loading="lazy" className="mb-5 aspect-[4/3] w-full rounded-xl object-cover object-top" />}
                    <div className="flex items-center justify-between">
                      {s.rating ? <div className="flex gap-0.5 text-accent" aria-label={`${s.rating} out of 5`}>{Array.from({ length: s.rating }).map((_, i) => <Star key={i} className="size-3.5 fill-current" />)}</div> : <span />}
                      <Quote className="size-5 text-accent/50" />
                    </div>
                    <blockquote className="mt-4 flex-1 font-serif text-xl leading-snug">“{s.quote}”</blockquote>
                    <figcaption className="mt-5 border-t border-border pt-4 text-sm"><strong className="font-semibold">{s.name}</strong> <span className="text-muted-foreground">· {s.city} · Verified customer</span></figcaption>
                  </figure>
                ))}
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
        </>)}
      </div>
    </section>
  );
}
