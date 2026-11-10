import { useRef, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";

import { RevealOnScroll, TextReveal } from "@/components/motion/Reveal";
import { customerMediaService, isPublicMedia, type VideoReview } from "@/services/testimonialService";

/**
 * Portrait customer-video carousel. Videos load only when tapped (poster first), one plays at a time.
 * Native horizontal scroll with snap — no wheel interception or autoplay.
 */
export function VideoReviews() {
  const all = useSyncExternalStore(customerMediaService.subscribe, customerMediaService.videoReviews, customerMediaService.videoReviews);
  const videos = all.filter(isPublicMedia);
  const track = useRef<HTMLDivElement>(null);
  if (videos.length === 0) return null;

  const scrollBy = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    el.scrollBy({ left: dir * ((card?.offsetWidth ?? 260) + 16) * (window.innerWidth >= 768 ? 2 : 1), behavior: "smooth" });
  };

  return (
    <section aria-labelledby="video-reviews-h" className="overflow-hidden py-20 md:py-28">
      <div className="container-lux">
        <div className="flex flex-col items-center justify-between gap-5 text-center md:flex-row md:items-end md:text-left">
          <div>
            <RevealOnScroll as="p" kind="fade" className="eyebrow">Customer videos</RevealOnScroll>
            <h2 id="video-reviews-h" className="sr-only">Trusted &amp; engaging experience</h2>
            <TextReveal text="Trusted & engaging experience" className="mt-3 text-4xl md:text-5xl" delay={80} />
            <p className="mt-4 max-w-md text-sm text-muted-foreground">Real customers sharing their experience — as published on our original website.</p>
          </div>
          <div className="hidden gap-2 md:flex">
            <button type="button" onClick={() => scrollBy(-1)} aria-label="Previous videos" className="press grid size-12 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"><ChevronLeft className="size-5" /></button>
            <button type="button" onClick={() => scrollBy(1)} aria-label="Next videos" className="press grid size-12 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"><ChevronRight className="size-5" /></button>
          </div>
        </div>
      </div>

      <div ref={track} className="no-scrollbar mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-4 md:scroll-px-[max(2rem,calc((100vw-80rem)/2+2rem))] md:px-[max(2rem,calc((100vw-80rem)/2+2rem))]" aria-label="Customer video reviews">
        {videos.map((v, i) => <VideoCard key={v.id} video={v} index={i} total={videos.length} />)}
      </div>

      <div className="mt-4 flex justify-center gap-2 md:hidden">
        <button type="button" onClick={() => scrollBy(-1)} aria-label="Previous video" className="press grid size-11 place-items-center rounded-full border border-border bg-background"><ChevronLeft className="size-5" /></button>
        <button type="button" onClick={() => scrollBy(1)} aria-label="Next video" className="press grid size-11 place-items-center rounded-full border border-border bg-background"><ChevronRight className="size-5" /></button>
      </div>
    </section>
  );
}

function VideoCard({ video, index, total }: { video: VideoReview; index: number; total: number }) {
  const [on, setOn] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  const start = () => {
    document.querySelectorAll<HTMLVideoElement>("video[data-review]").forEach((el) => el.pause());
    setOn(true);
    requestAnimationFrame(() => ref.current?.play().catch(() => {}));
  };

  return (
    <div data-card className="relative w-[68vw] max-w-[280px] shrink-0 snap-start overflow-hidden rounded-2xl bg-primary shadow-[var(--shadow-soft)] sm:w-[240px] md:w-[260px]" aria-label={`${video.title} ${index + 1} of ${total}`} role="group">
      <div className="relative aspect-[9/16] w-full">
        {on ? (
          <video ref={ref} data-review src={video.src} poster={video.poster} controls playsInline preload="metadata"
            onPlay={(e) => document.querySelectorAll<HTMLVideoElement>("video[data-review]").forEach((el) => el !== e.currentTarget && el.pause())}
            className="absolute inset-0 h-full w-full bg-primary object-cover" />
        ) : (
          <button type="button" onClick={start} aria-label={`Play ${video.title.toLowerCase()} ${index + 1}`} className="group absolute inset-0 text-left">
            <img src={video.poster} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent" />
            <span className="absolute inset-0 grid place-items-center"><span className="grid size-14 place-items-center rounded-full bg-background/90 text-primary shadow-lift transition-transform duration-300 group-hover:scale-110"><Play className="ml-1 size-5 fill-current" /></span></span>
            <span className="absolute inset-x-4 bottom-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-foreground">{video.title}</span>
          </button>
        )}
      </div>
    </div>
  );
}
