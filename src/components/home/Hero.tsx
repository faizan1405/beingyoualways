import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { BeforeAfter } from "./BeforeAfter";
import { Parallax } from "@/components/motion/Reveal";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="bg-hero relative overflow-hidden">
      <div className="container-lux grid min-h-[calc(100svh-6.5rem)] md:max-h-[860px] items-center gap-4 py-10 md:grid-cols-2 md:py-0">
        <div className="order-2 text-center md:order-1 md:text-left">
          <Parallax speed={0.05}>
          <p className="eyebrow hero-in" style={{ animationDelay: "100ms" }}>Plant-based beauty · Made in India</p>
          <h1 className="mt-5 text-[2.9rem] leading-[0.98] sm:text-6xl lg:text-[5.4rem]" aria-label="Beauty that feels like you, always.">
            {["Beauty", "that", "feels", "|", "like you,", "always."].map((w, i) =>
              w === "|" ? <br key={i} /> : (
                <span key={i} aria-hidden className="text-mask mr-[0.22em]">
                  <span className={`hero-word ${w === "like you," ? "italic text-accent" : ""}`} style={{ animationDelay: `${220 + i * 85}ms` }}>{w}</span>
                </span>
              ),
            )}
          </h1>
          <p className="hero-in mx-auto mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground md:mx-0" style={{ animationDelay: "800ms" }}>
            See the transformation. Botanical skincare, haircare and colour — gentle rituals for every day.
          </p>
          <div className="hero-in mt-9 flex flex-col items-center gap-3 sm:flex-row md:justify-start" style={{ animationDelay: "950ms" }}>
            <Button variant="lux" size="xl" className="group" asChild><Link to="/shop">Shop Collection <ArrowRight className="arrow-nudge" /></Link></Button>
            <Button variant="link" asChild className="group uppercase tracking-[0.14em] text-xs"><Link to="/about">Our story <ArrowRight className="arrow-nudge" /></Link></Button>
          </div>
          </Parallax>
        </div>
        <div className="hero-in order-1 mx-auto aspect-[4/5] w-full max-w-[min(100%,440px)] md:order-2 md:max-h-[min(78vh,680px)] md:max-w-[520px]" style={{ animationDelay: "300ms" }}>
          <BeforeAfter />
        </div>
      </div>
    </section>
  );
}
