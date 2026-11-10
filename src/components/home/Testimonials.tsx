import { useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MessageSquareQuote, Play, Quote, Star } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { productService } from "@/services/productService";

import { RevealOnScroll, TextReveal } from "@/components/motion/Reveal";
import { customerMediaService, isPublicMedia, testimonialCategories, testimonialService, type PhotoStory, type TestimonialCategory } from "@/services/testimonialService";


/** Public customer stories. Shows only verified, consented, published entries — never placeholder copy. */
export function Testimonials({ id }: { id?: string } = {}) {
  const all = useSyncExternalStore(testimonialService.subscribe, testimonialService.all, testimonialService.all);
  const stories = useSyncExternalStore(customerMediaService.subscribe, customerMediaService.photoStories, customerMediaService.photoStories).filter(isPublicMedia);
  const list = all.filter((t) => t.verified && t.consent && t.published);
  const tabs = testimonialCategories.filter((c) => list.some((t) => t.category === c));
  const [picked, setTab] = useState<TestimonialCategory>("Skin");
  const tab = tabs.includes(picked) ? picked : (tabs[0] ?? picked);
  const items = list.filter((t) => t.category === tab);
  const [playing, setPlaying] = useState<(typeof list)[number] | null>(null);

  return (
    <section id={id} className="bg-secondary" aria-label="Customer stories">
      <div className="container-lux py-20 md:py-28">
        <div className="text-center">
          <RevealOnScroll as="p" kind="fade" className="eyebrow">Customer stories</RevealOnScroll>
          <TextReveal text="In their own words" className="mt-3 text-4xl md:text-5xl" delay={80} />
          <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">Only verified reviews shared with the customer's permission appear here.</p>
        </div>
        {stories.map((st) => <PhotoStoryCard key={st.id} story={st} />)}
        {list.length === 0 ? (stories.length > 0 ? null : (
          <div className="mx-auto mt-10 max-w-md rounded-2xl border border-dashed border-border bg-card px-8 py-12 text-center">
            <MessageSquareQuote className="mx-auto size-7 text-accent" strokeWidth={1.4} />
            <p className="mt-4 font-serif text-2xl">Customer stories are on their way</p>
            <p className="mt-2 text-sm text-muted-foreground">We'll share skin, hair and de-tan stories here once customers have given permission.</p>
          </div>
        )) : (<>
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
                    {s.type === "video" && s.videoUrl ? (
                      <button type="button" onClick={() => setPlaying(s)} aria-label={`Play video story from ${s.name}`} className="group relative mb-5 aspect-[4/3] w-full overflow-hidden rounded-xl bg-primary">
                        {s.poster && <img src={s.poster} alt="" loading="lazy" className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-105" />}
                        <span className="absolute inset-0 grid place-items-center"><span className="grid size-16 place-items-center rounded-full bg-background/90 text-primary shadow-lift transition-transform duration-300 group-hover:scale-110"><Play className="ml-1 size-6 fill-current" /></span></span>
                        <span className="absolute left-3 top-3 rounded-full bg-background/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground">Video · {s.category}</span>
                      </button>
                    ) : s.photo && <img src={s.photo} alt={`${s.name}, customer`} loading="lazy" className="mb-5 aspect-[4/3] w-full rounded-xl object-cover object-top" />}
                    <div className="flex items-center justify-between">
                      {s.rating ? <div className="flex gap-0.5 text-accent" aria-label={`${s.rating} out of 5`}>{Array.from({ length: s.rating }).map((_, i) => <Star key={i} className="size-3.5 fill-current" />)}</div> : <span />}
                      <Quote className="size-5 text-accent/50" />
                    </div>
                    <blockquote className="mt-4 flex-1 font-serif text-xl leading-snug">“{s.quote}”</blockquote>
                    <figcaption className="mt-5 border-t border-border pt-4 text-sm"><strong className="font-semibold">{s.name}</strong> <span className="text-muted-foreground">· {s.city} · Verified customer</span>{s.productSlug && <ProductRef slug={s.productSlug} />}</figcaption>
                  </figure>
                ))}
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
        </>)}
      </div>
      <Dialog open={!!playing} onOpenChange={(o) => !o && setPlaying(null)}>
        <DialogContent className="max-w-3xl overflow-hidden p-0">
          <DialogTitle className="sr-only">{playing ? `Video story from ${playing.name}` : "Video story"}</DialogTitle>
          {playing?.videoUrl && <video src={playing.videoUrl} poster={playing.poster} controls playsInline preload="metadata" className="aspect-video w-full bg-primary" />}
          {playing && <p className="px-6 pb-5 font-serif text-lg">“{playing.quote}” <span className="font-sans text-sm text-muted-foreground">— {playing.name}</span></p>}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Real customer photo set, shown as published on the brand's site — no quote or result claim added. */
function PhotoStoryCard({ story }: { story: PhotoStory }) {
  const pos = ["50% 38%", "50% 22%", "50% 30%"];
  return (
    <RevealOnScroll as="figure" kind="fade" className="mx-auto mt-10 grid max-w-5xl items-center gap-6 rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] sm:p-6 md:grid-cols-[1.7fr_1fr] md:gap-10 md:p-8">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {story.photos.map((ph, i) => (
          <div key={ph.label} className="relative overflow-hidden rounded-xl bg-secondary">
            <img src={ph.src} alt={ph.alt} loading="lazy" decoding="async" width={520} height={1110} className="aspect-[3/5] w-full object-cover" style={{ objectPosition: pos[i] }} />
            <span className="absolute inset-x-1.5 bottom-1.5 rounded-full bg-background/90 px-2 py-1 text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground backdrop-blur sm:inset-x-2 sm:bottom-2 sm:text-[10px]">{ph.label}</span>
          </div>
        ))}
      </div>
      <figcaption className="text-center md:text-left">
        <p className="eyebrow">Real customer · {story.city}</p>
        <p className="mt-3 font-serif text-3xl leading-tight md:text-4xl">A journey, in her own photos.</p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Photos shared by a customer from {story.city}, shown just as they appear on our original website. Every skin's journey is different.</p>
        <p className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary"><Star className="size-3 fill-current" /> {story.source}</p>
      </figcaption>
    </RevealOnScroll>
  );
}

function ProductRef({ slug }: { slug: string }) {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => { productService.getBySlug(slug).then((p) => setName(p?.name ?? null)).catch(() => {}); }, [slug]);
  return name ? <span className="mt-1 block text-xs text-muted-foreground">Used: {name}</span> : null;
}
