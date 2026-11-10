import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, Play } from "lucide-react";

import { RevealOnScroll, TextReveal } from "@/components/motion/Reveal";
import { customerMediaService, isPublicMedia, type VideoReview } from "@/services/testimonialService";

/**
 * Shared portrait customer-video carousel (homepage + Explore by Concern).
 * - Each card renders a real <video preload="none"> from the start, so no video bytes load until Play.
 * - play() is called synchronously inside the tap/click handler. Safari/iOS only allow sound
 *   playback when play() runs inside the user gesture — deferring it (e.g. to the next frame)
 *   makes the browser silently refuse.
 * - One video plays at a time; a video pauses when scrolled out of view.
 * - Load errors show a fallback instead of a dead player.
 */
let currentVideo: HTMLVideoElement | null = null;
function claimPlayback(v: HTMLVideoElement) {
  if (currentVideo && currentVideo !== v && !currentVideo.paused) currentVideo.pause();
  currentVideo = v;
}

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

  const arrow = "btn-motion grid place-items-center rounded-full border border-border bg-background text-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground active:scale-95";

  return (
    <section aria-label="Customer videos" className="overflow-hidden py-20 md:py-28">
      <div className="container-lux">
        <div className="flex flex-col items-center justify-between gap-5 text-center md:flex-row md:items-end md:text-left">
          <div>
            <RevealOnScroll as="p" kind="fade" className="eyebrow">Customer videos</RevealOnScroll>
            <TextReveal text="Trusted & engaging experience" className="mt-3 text-4xl md:text-5xl" delay={80} />
            <p className="mt-4 max-w-md text-sm text-muted-foreground">Real customers sharing their experience — as published on our original website.</p>
          </div>
          <div className="hidden gap-2 md:flex">
            <button type="button" onClick={() => scrollBy(-1)} aria-label="Previous videos" className={`${arrow} size-12`}><ChevronLeft className="size-5" /></button>
            <button type="button" onClick={() => scrollBy(1)} aria-label="Next videos" className={`${arrow} size-12`}><ChevronRight className="size-5" /></button>
          </div>
        </div>
      </div>

      <div ref={track} className="no-scrollbar mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-4 md:scroll-px-[max(2.5rem,calc((100vw-80rem)/2+2.5rem))] md:px-[max(2.5rem,calc((100vw-80rem)/2+2.5rem))]" aria-label="Customer video reviews">
        {videos.map((v, i) => <VideoCard key={v.id} video={v} index={i} total={videos.length} />)}
      </div>

      <div className="mt-4 flex justify-center gap-2 md:hidden">
        <button type="button" onClick={() => scrollBy(-1)} aria-label="Previous video" className={`${arrow} size-11`}><ChevronLeft className="size-5" /></button>
        <button type="button" onClick={() => scrollBy(1)} aria-label="Next video" className={`${arrow} size-11`}><ChevronRight className="size-5" /></button>
      </div>
    </section>
  );
}

type PlayerState = "idle" | "loading" | "playing" | "paused" | "error";

function VideoCard({ video, index, total }: { video: VideoReview; index: number; total: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<PlayerState>("idle");
  const started = state !== "idle";

  // Pause when the card leaves the viewport (scrolling away or sliding the carousel).
  useEffect(() => {
    const v = ref.current;
    if (!v || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => { if (e && !e.isIntersecting && !v.paused) v.pause(); }, { threshold: 0.2 });
    io.observe(v);
    return () => { io.disconnect(); if (currentVideo === v) currentVideo = null; };
  }, []);

  const start = () => {
    const v = ref.current;
    if (!v) return;
    claimPlayback(v);
    setState("loading");
    // Must stay synchronous inside the click/tap handler (see note above).
    const p = v.play();
    if (p && typeof p.catch === "function") {
      p.catch((err: unknown) => {
        if (v.error) return setState("error");
        // Browser refused (e.g. power-saving mode): leave native controls visible so one more tap plays it.
        if ((err as { name?: string })?.name !== "AbortError") setState("paused");
      });
    }
  };

  const label = `${video.title} ${index + 1} of ${total}`;

  return (
    <div data-card data-state={state} className="relative w-[68vw] max-w-[280px] shrink-0 snap-start overflow-hidden rounded-2xl bg-primary shadow-[var(--shadow-soft)] sm:w-[240px] md:w-[260px]" aria-label={label} role="group">
      <div className="relative aspect-[9/16] w-full">
        <video
          ref={ref}
          data-review
          src={video.src}
          poster={started ? video.poster : undefined}
          preload="none"
          playsInline
          controls={started && state !== "error"}
          controlsList="nodownload"
          aria-label={`Customer video ${index + 1}`}
          tabIndex={started ? 0 : -1}
          onPlay={(e) => claimPlayback(e.currentTarget)}
          onPlaying={() => setState("playing")}
          onWaiting={() => setState((s) => (s === "playing" ? "loading" : s))}
          onPause={() => setState((s) => (s === "error" || s === "idle" ? s : "paused"))}
          onEnded={() => setState("paused")}
          onError={() => setState("error")}
          className="absolute inset-0 h-full w-full bg-primary object-cover"
        />

        {!started && (
          <button type="button" onClick={start} aria-label={`Play ${video.title.toLowerCase()} ${index + 1}`} className="group absolute inset-0 text-left">
            <img src={video.poster} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent" />
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-14 place-items-center rounded-full bg-background/90 text-primary shadow-lift transition-transform duration-300 group-hover:scale-110 group-active:scale-95">
                <Play className="ml-1 size-5 fill-current" />
              </span>
            </span>
            <span className="absolute inset-x-4 bottom-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-foreground">{video.title}</span>
          </button>
        )}

        {state === "loading" && (
          <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="grid size-14 place-items-center rounded-full bg-background/85 text-primary shadow-lift"><Loader2 className="size-5 animate-spin" /></span>
          </span>
        )}

        {state === "error" && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-primary/90 p-6 text-center text-primary-foreground">
            <AlertCircle className="size-7 text-accent" strokeWidth={1.5} />
            <p className="text-sm font-medium">This video couldn't be played here.</p>
            <a href={video.src} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold uppercase tracking-[0.16em] underline underline-offset-4">Open video</a>
            <button type="button" onClick={() => { const v = ref.current; if (v) { v.load(); start(); } }} className="text-xs opacity-80 underline underline-offset-4">Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}
