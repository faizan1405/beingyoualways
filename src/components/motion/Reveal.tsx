/**
 * Reusable motion primitives for the storefront.
 * One shared IntersectionObserver and one shared scroll/rAF loop power every
 * reveal and parallax element. Content is visible by default and only hidden
 * while <html class="motion-ok"> is set (see __root.tsx + styles.css).
 */
import { Children, createElement, useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type RevealKind = "fade-up" | "fade" | "slide-left" | "slide-right" | "scale" | "image" | "image-left" | "text";

// ── shared observer ──────────────────────────────────────────────
let io: IntersectionObserver | null = null;
function observe(el: Element) {
  if (typeof IntersectionObserver === "undefined") {
    el.classList.add("is-in");
    return () => {};
  }
  document.documentElement.classList.add("motion-js");
  io ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io?.unobserve(e.target);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
  );
  io.observe(el);
  return () => io?.unobserve(el);
}

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => (ref.current ? observe(ref.current) : undefined), []);
  return ref;
}

interface RevealProps {
  as?: ElementType | undefined;
  kind?: RevealKind | undefined;
  delay?: number | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  children?: ReactNode;
  id?: string | undefined;
}

/** Fades/slides an element in once when it approaches the viewport. */
export function RevealOnScroll({ as = "div", kind = "fade-up", delay = 0, className, style, children, id }: RevealProps) {
  const ref = useReveal<HTMLElement>();
  return createElement(as, { ref, id, "data-reveal": kind, className, style: { ...style, "--reveal-delay": `${delay}ms` } }, children);
}

export const AnimatedSection = (p: RevealProps) => <RevealOnScroll as="section" {...p} />;

/** Applies an increasing delay to each direct child (50–100ms steps). */
export function StaggerContainer({
  children, step = 80, kind = "fade-up", className, itemClassName, max = 8,
}: { children: ReactNode; step?: number; kind?: RevealKind; className?: string; itemClassName?: string; max?: number }) {
  return (
    <div className={className}>
      {Children.toArray(children).map((child, i) => (
        <RevealOnScroll key={i} kind={kind} delay={Math.min(i, max) * step} className={itemClassName}>{child}</RevealOnScroll>
      ))}
    </div>
  );
}

/**
 * Masked text reveal. `by="word"` for hero phrases, `by="line"` for headings
 * (pass lines as an array). Screen readers get the plain text.
 */
export function TextReveal({
  text, as = "h2", by = "word", delay = 0, className,
}: { text: string | ReactNode[]; as?: ElementType; by?: "word" | "line"; delay?: number; className?: string }) {
  const ref = useReveal<HTMLElement>();
  const parts: ReactNode[] = typeof text === "string" ? (by === "word" ? text.split(" ") : [text]) : text;
  const label = typeof text === "string" ? text : undefined;
  return createElement(
    as,
    { ref, "data-reveal": "text", className, style: { "--reveal-delay": `${delay}ms` }, "aria-label": label },
    parts.map((p, i) => (
      <span key={i} aria-hidden={label ? true : undefined}>
        <span className="text-mask"><span style={{ "--i": i } as CSSProperties}>{p}</span></span>
        {by === "word" && i < parts.length - 1 ? " " : by === "line" && i < parts.length - 1 ? <br /> : null}
      </span>
    )),
  );
}

/** Clip-mask image reveal with a subtle scale-down of the inner layer. */
export function ImageReveal({
  children, className, delay = 0, from = "bottom",
}: { children: ReactNode; className?: string; delay?: number; from?: "bottom" | "left" }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} data-reveal={from === "left" ? "image-left" : "image"} className={cn("overflow-hidden", className)} style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}>
      <div className="reveal-inner h-full w-full">{children}</div>
    </div>
  );
}

// ── shared parallax loop ─────────────────────────────────────────
const parallaxEls = new Map<HTMLElement, number>();
let rafId = 0;
let listening = false;
function tick() {
  rafId = 0;
  const vh = window.innerHeight;
  parallaxEls.forEach((speed, el) => {
    const r = el.parentElement?.getBoundingClientRect();
    if (!r || r.bottom < -100 || r.top > vh + 100) return;
    const offset = (r.top + r.height / 2 - vh / 2) * speed;
    el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
  });
}
const onScroll = () => { if (!rafId) rafId = requestAnimationFrame(tick); };

/**
 * Moves its content slower/faster than the page. Disabled on touch/small
 * screens and for reduced-motion users.
 */
export function Parallax({ speed = -0.08, className, children }: { speed?: number; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ok = window.matchMedia("(min-width: 768px) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches;
    if (!ok) return;
    parallaxEls.set(el, speed);
    if (!listening) {
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      listening = true;
    }
    onScroll();
    return () => {
      parallaxEls.delete(el);
      el.style.transform = "";
      if (parallaxEls.size === 0 && listening) {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        listening = false;
      }
    };
  }, [speed]);
  return <div ref={ref} data-parallax className={className}>{children}</div>;
}
