import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Quote, Star } from "lucide-react";

import story1 from "@/assets/testimonials/story-1.webp";
import story2 from "@/assets/testimonials/story-2.webp";
import story3 from "@/assets/testimonials/story-3.webp";
import resultBefore from "@/assets/testimonials/result-before.webp";
import resultAfter from "@/assets/testimonials/result-after.webp";
import { RevealOnScroll, TextReveal } from "@/components/motion/Reveal";

type Story = { name: string; city: string; text: string; concern: string; category: string; photo?: string };

/** Placeholder copy until real, consented reviews are supplied by the client. */
const groups: Record<string, Story[]> = {
  Skin: [
    { name: "Ananya R.", city: "Kolkata", text: "My skin feels calmer and my routine finally feels simple. I look forward to it every night.", concern: "Glow", category: "Skin care", photo: story3 },
    { name: "Meera S.", city: "Pune", text: "Gentle enough for my sensitive skin. No heaviness, just a soft, comfortable finish.", concern: "Sensitive skin", category: "Skin care" },
    { name: "Ritika P.", city: "Delhi", text: "The textures are lovely and the ingredients are listed clearly — that honesty matters to me.", concern: "Acne-prone skin", category: "Skin care" },
  ],
  Hair: [
    { name: "Sunita D.", city: "Kolkata", text: "My hair feels softer and less dry after washing. The herbal scent is a bonus.", concern: "Hair care", category: "Hair care" },
    { name: "Kavya N.", city: "Bengaluru", text: "I've been oiling weekly and my scalp feels so much more comfortable.", concern: "Hair fall", category: "Hair care" },
  ],
  "Pigmentation / De-Tan": [
    { name: "Rekha M.", city: "Howrah", text: "I've been consistent with my routine and I'm happy with how my skin looks today.", concern: "Pigmentation", category: "De-tan care", photo: resultAfter },
    { name: "Pooja K.", city: "Jaipur", text: "After summer my skin looked dull. Using it regularly, it now looks more even and fresh.", concern: "Tan removal", category: "De-tan care" },
  ],
  "General Experience": [
    { name: "Ishita B.", city: "Mumbai", text: "Lovely packaging, quick help on WhatsApp and everything arrived safely.", concern: "Service", category: "Experience" },
    { name: "Nandini G.", city: "Chennai", text: "It feels like a brand made by people who actually care. Warm and personal.", concern: "Trust", category: "Experience" },
  ],
  "Customer Love": [
    { name: "Priya A.", city: "Kolkata", text: "Smiling more in photos these days — feeling good in my own skin.", concern: "Confidence", category: "Customer love", photo: story2 },
    { name: "Aditi S.", city: "Kolkata", text: "Small, mindful self-care moments every day. That's what this brand gave me.", concern: "Self-care", category: "Customer love", photo: story1 },
  ],
};

export function Testimonials() {
  const tabs = Object.keys(groups);
  const [tab, setTab] = useState<string>("Skin");
  return (
    <section className="bg-secondary">
      <div className="container-lux py-20 md:py-28">
        <div className="text-center">
          <RevealOnScroll as="p" kind="fade" className="eyebrow">Real stories</RevealOnScroll>
          <TextReveal text="Loved by real people" className="mt-3 text-4xl md:text-5xl" delay={80} />
          <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">Sample reviews for this preview — final customer words will be added with their consent.</p>
        </div>
        <div role="tablist" aria-label="Testimonial categories" className="mx-auto mt-10 flex max-w-full gap-2 overflow-x-auto pb-2 md:justify-center">
          {tabs.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`press shrink-0 rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${tab === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:border-primary"}`}>
              {t}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={tab} role="tabpanel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }}
            className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {(groups[tab] ?? []).map((s) => (
              <figure key={s.name} className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft,0_1px_2px_rgb(0_0_0/0.04))]">
                {s.photo && <img src={s.photo} alt={`${s.name}, customer`} loading="lazy" className="mb-5 aspect-[4/3] w-full rounded-xl object-cover object-top" />}
                <div className="flex items-center justify-between">
                  <div className="flex gap-0.5 text-accent" aria-label="5 out of 5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="size-3.5 fill-current" />)}</div>
                  <Quote className="size-5 text-accent/50" />
                </div>
                <blockquote className="mt-4 flex-1 font-serif text-xl leading-snug">“{s.text}”</blockquote>
                <figcaption className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-sm">
                  <span><strong className="font-semibold">{s.name}</strong> <span className="text-muted-foreground">· {s.city}</span></span>
                  <span className="flex gap-1.5">
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider">{s.concern}</span>
                    <span className="rounded-full border border-border px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">{s.category}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

export function RealResults() {
  return (
    <section className="container-lux py-20 md:py-28">
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <RevealOnScroll as="p" kind="fade" className="eyebrow">Real results</RevealOnScroll>
          <TextReveal by="line" text={["Shared by", <em key="e">our community.</em>]} className="mt-3 text-4xl leading-tight md:text-5xl" />
          <RevealOnScroll as="p" delay={250} className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Unretouched photos shared by customers along their routine. Every skin is different — results vary from person to person and depend on consistent use.
          </RevealOnScroll>
        </div>
        <RevealOnScroll kind="slide-right" delay={150} className="grid grid-cols-2 gap-4">
          {[{ src: resultBefore, l: "Before" }, { src: resultAfter, l: "After" }].map((r) => (
            <figure key={r.l} className="relative overflow-hidden rounded-2xl bg-card">
              <img src={r.src} alt={`Customer forehead and skin tone, ${r.l.toLowerCase()} her routine`} loading="lazy" className="aspect-[3/4] w-full object-cover object-top" />
              <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]">{r.l}</span>
            </figure>
          ))}
          <p className="col-span-2 text-xs text-muted-foreground">Customer photo · Pigmentation & hairline care · Individual results vary</p>
        </RevealOnScroll>
      </div>
      <div className="mt-14 grid grid-cols-3 gap-3 md:gap-5">
        {[story1, story2, story3].map((src, i) => (
          <RevealOnScroll key={i} delay={i * 120} className="overflow-hidden rounded-2xl">
            <img src={src} alt="Smiling customer" loading="lazy" className="aspect-[4/5] w-full object-cover object-top transition-transform duration-700 hover:scale-[1.04]" />
          </RevealOnScroll>
        ))}
      </div>
    </section>
  );
}
