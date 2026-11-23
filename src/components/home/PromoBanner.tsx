import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSiteContent } from "@/hooks/use-demo-store";

/** Optional promotional band set in Admin → Website content (off by default). */
export function PromoBanner() {
  const { promo } = useSiteContent();
  if (!promo.enabled || !promo.heading.trim()) return null;
  return (
    <section className="border-t border-border/60 bg-page" aria-label="Promotion">
      <div className={`container-lux grid items-center gap-8 py-14 md:py-20 ${promo.image ? "md:grid-cols-2" : "text-center"}`}>
        {promo.image && <img src={promo.image} alt="" className="aspect-[16/10] w-full rounded-2xl object-cover shadow-[var(--shadow-soft)]" />}
        <div>
          <h2 className="text-4xl leading-tight md:text-5xl">{promo.heading}</h2>
          {promo.text && <p className={`mt-4 text-[15px] leading-relaxed text-muted-foreground ${promo.image ? "" : "mx-auto max-w-xl"}`}>{promo.text}</p>}
          <Button variant="luxOutline" size="xl" className="group mt-7" asChild><Link to={promo.linkTo}>{promo.linkLabel || "Shop now"} <ArrowRight className="arrow-nudge" /></Link></Button>
        </div>
      </div>
    </section>
  );
}
