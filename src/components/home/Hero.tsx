import { ClientOnly, Link } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ProductVisual } from "@/components/shop/ProductVisual";

const HeroScene = lazy(() => import("./HeroScene"));

function canWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function StaticFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <ProductVisual shape="dropper" tint="oklch(0.7 0.07 40)" label="Being You serum" className="w-[70%] max-w-xs rounded-full !bg-transparent" />
    </div>
  );
}

function Scene() {
  const [ok, setOk] = useState<boolean | null>(null);
  const [still, setStill] = useState(false);
  useEffect(() => {
    setOk(canWebGL());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStill(mq.matches);
  }, []);
  if (!ok) return <StaticFallback />;
  return (
    <Suspense fallback={<StaticFallback />}>
      <HeroScene still={still} />
    </Suspense>
  );
}

export function Hero() {
  return (
    <section className="bg-hero relative overflow-hidden">
      <div className="container-lux grid min-h-[calc(100svh-6.5rem)] md:max-h-[860px] items-center gap-4 py-10 md:grid-cols-2 md:py-0">
        <div className="order-2 text-center md:order-1 md:text-left">
          <p className="eyebrow">Plant-based beauty · Made in India</p>
          <h1 className="mt-5 text-[2.9rem] leading-[0.98] sm:text-6xl lg:text-[5.4rem]">
            Beauty that feels<br /><em className="text-accent">like you,</em> always.
          </h1>
          <p className="mx-auto mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground md:mx-0">
            Botanical skincare, haircare and colour — gentle rituals for every day.
          </p>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row md:justify-start">
            <Button variant="lux" size="xl" asChild><Link to="/shop">Shop Collection</Link></Button>
            <Button variant="link" asChild className="uppercase tracking-[0.14em] text-xs"><Link to="/about">Our story →</Link></Button>
          </div>
        </div>
        <div className="order-1 h-[52vh] min-h-[320px] md:order-2 md:h-[min(78vh,720px)]" aria-label="Rotating 3D view of a Being You serum bottle" role="img">
          <ClientOnly fallback={<StaticFallback />}>
            <Scene />
          </ClientOnly>
        </div>
      </div>
    </section>
  );
}
