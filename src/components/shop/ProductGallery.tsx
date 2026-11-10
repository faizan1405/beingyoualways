import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ProductShape } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProductVisual } from "./ProductVisual";

/**
 * Product photo gallery: clickable thumbnails, swipe on touch, hover-zoom on desktop
 * and a full-screen viewer. Only real photos are shown — no padding slides.
 */
export function ProductGallery({ images, name, shape, tint }: { images: string[]; name: string; shape: ProductShape; tint: string }) {
  const n = images.length;
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [canZoom, setCanZoom] = useState(false);
  const [full, setFull] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const on = () => setCanZoom(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const dragged = useRef(false);
  const markLoaded = useCallback((i: number) => setLoaded((l) => (l[i] ? l : { ...l, [i]: true })), []);
  const go = useCallback((d: number) => setIdx((i) => (i + d + n) % n), [n]);
  const alt = (i: number) => `${name} — photo ${i + 1} of ${n}`;

  if (n === 0) return <ProductVisual shape={shape} tint={tint} label={name} eager className="rounded-xl" />;

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!canZoom) return;
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };
  const onKey = (e: KeyboardEvent) => {
    if (n < 2) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
  };

  return (
    <div onKeyDown={onKey}>
      <div
        className={cn("group relative aspect-[4/5] overflow-hidden rounded-xl bg-secondary hero-in", canZoom && "cursor-zoom-in")}
        onMouseMove={onMove}
        onMouseLeave={() => setZoom(null)}
        onClick={() => { if (!dragged.current) setFull(true); }}
        role="group"
        aria-roledescription="carousel"
        aria-label={`${name} photos`}
      >
        {!loaded[idx] && <div className="skeleton-shimmer absolute inset-0" aria-hidden />}
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={idx}
            initial={reduce ? false : { opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            drag={n > 1 && !canZoom ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.25}
            onDragStart={() => { dragged.current = true; }}
            onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 50) go(info.offset.x < 0 ? 1 : -1); setTimeout(() => { dragged.current = false; }, 0); }}
            className="absolute inset-0 touch-pan-y"
          >
            <img
              ref={(el) => { if (el?.complete && el.naturalWidth > 0 && !loaded[idx]) markLoaded(idx); }}
              src={images[idx]}
              alt={alt(idx)}
              width={900}
              height={1125}
              loading={idx === 0 ? "eager" : "lazy"}
              decoding="async"
              draggable={false}
              onLoad={() => markLoaded(idx)}
              className={cn("absolute inset-0 h-full w-full select-none object-cover transition-[opacity,transform] duration-300 ease-out", loaded[idx] ? "opacity-100" : "opacity-0")}
              style={zoom ? { transform: "scale(2)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
            />
          </motion.div>
        </AnimatePresence>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setFull(true); }}
          aria-label="Open full-screen photo viewer"
          className="press absolute right-3 top-3 grid size-11 place-items-center rounded-full bg-card/90 text-foreground shadow-soft backdrop-blur transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
        >
          <Expand className="size-4" />
        </button>

        {n > 1 && (
          <>
            <button type="button" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous photo" className="press absolute left-3 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-card/90 shadow-soft backdrop-blur transition-opacity md:grid md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"><ChevronLeft className="size-5" /></button>
            <button type="button" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next photo" className="press absolute right-3 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-card/90 shadow-soft backdrop-blur transition-opacity md:grid md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"><ChevronRight className="size-5" /></button>
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5 md:hidden" aria-hidden>
              {images.map((_, i) => <span key={i} className={cn("h-1.5 rounded-full bg-card/90 shadow-soft transition-all duration-300", i === idx ? "w-5" : "w-1.5 opacity-60")} />)}
            </div>
            <p className="sr-only" aria-live="polite">Photo {idx + 1} of {n}</p>
          </>
        )}
      </div>

      {n > 1 && (
        <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label="Choose a photo">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Show photo ${i + 1} of ${n}`}
              aria-current={idx === i}
              className={cn("press relative aspect-[4/5] w-[4.5rem] shrink-0 overflow-hidden rounded-md border-2 bg-secondary transition-all duration-300 sm:w-20", idx === i ? "border-primary shadow-soft" : "border-transparent opacity-60 hover:opacity-100")}
            >
              <img src={src} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <Dialog open={full} onOpenChange={setFull}>
        <DialogContent className="flex h-[100svh] max-h-none w-screen max-w-none flex-col gap-0 rounded-none border-0 bg-background p-0 sm:rounded-none [&>button:last-child]:hidden" onKeyDown={(e) => { e.stopPropagation(); onKey(e); }}>
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <DialogTitle className="truncate font-serif text-xl font-normal">{name}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">Photo {idx + 1} of {n}{n > 1 ? " · use arrow keys or swipe" : ""}</DialogDescription>
            </div>
            <button type="button" onClick={() => setFull(false)} aria-label="Close photo viewer" className="press grid size-11 shrink-0 place-items-center rounded-full hover:bg-secondary"><X className="size-5" /></button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center bg-secondary/60 p-3">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.img
                key={idx}
                src={images[idx]}
                alt={alt(idx)}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                drag={n > 1 ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.25}
                onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 50) go(info.offset.x < 0 ? 1 : -1); }}
                className="max-h-full max-w-full touch-pan-y select-none rounded-lg object-contain"
                draggable={false}
              />
            </AnimatePresence>
            {n > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="press absolute left-3 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-card shadow-soft"><ChevronLeft className="size-5" /></button>
                <button type="button" onClick={() => go(1)} aria-label="Next photo" className="press absolute right-3 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-card shadow-soft"><ChevronRight className="size-5" /></button>
              </>
            )}
          </div>
          {n > 1 && (
            <div className="flex justify-center gap-2 overflow-x-auto border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {images.map((src, i) => (
                <button key={src} type="button" onClick={() => setIdx(i)} aria-label={`Show photo ${i + 1} of ${n}`} aria-current={idx === i}
                  className={cn("press relative aspect-[4/5] w-14 shrink-0 overflow-hidden rounded border-2", idx === i ? "border-primary" : "border-transparent opacity-60")}>
                  <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
