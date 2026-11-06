import { Link, createFileRoute } from "@tanstack/react-router";

import { ProductVisual } from "@/components/shop/ProductVisual";
import { Button } from "@/components/ui/button";
import { ImageReveal, Parallax, RevealOnScroll, TextReveal } from "@/components/motion/Reveal";

export const Route = createFileRoute("/_site/about")({
  head: () => ({
    meta: [
      { title: "About Us | Being You – Always" },
      { name: "description", content: "The story behind Being You – Always, a plant-based beauty brand from India." },
      { property: "og:title", content: "About Us | Being You – Always" },
      { property: "og:description", content: "Our story and philosophy." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <>
      <section className="bg-secondary py-20 text-center md:py-28">
        <div className="container-lux max-w-3xl">
          <p className="eyebrow hero-in">About us</p>
          <TextReveal as="h1" by="line" text={["Beauty, the way", <><em>you</em> already are.</>]} className="mt-4 text-5xl leading-tight md:text-7xl" delay={120} />
        </div>
      </section>
      <section className="container-lux grid items-center gap-12 py-20 md:grid-cols-2">
        <Parallax speed={-0.05}><ImageReveal className="rounded-xl"><ProductVisual shape="jar" tint="oklch(0.82 0.08 70)" label="Being You ritual" variant={2} /></ImageReveal></Parallax>
        <RevealOnScroll kind="slide-right" delay={150} className="space-y-5 text-[15px] leading-relaxed text-muted-foreground">
          <h2 className="text-4xl text-foreground">Our story</h2>
          <p>Being You – Always was born from a wish for beauty that feels personal and kind — inspired by the botanicals found in Indian homes for generations.</p>
          <p>We create plant-based skincare, haircare and colour for everyday rituals, with clear ingredient lists and textures you'll love to use.</p>
          <p className="text-xs italic">Draft copy — to be replaced with the founder's approved story.</p>
          <Button variant="lux" size="xl" asChild><Link to="/shop">Explore the range</Link></Button>
        </RevealOnScroll>
      </section>
    </>
  );
}
