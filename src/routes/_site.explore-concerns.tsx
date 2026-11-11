import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown } from "lucide-react";

import acneAfter from "@/assets/concerns/acne-after.jpg";
import acneBefore from "@/assets/concerns/acne-before.jpg";
import hairAfter from "@/assets/concerns/hair-comb-after.jpg";
import hairBefore from "@/assets/concerns/hair-comb-before.jpg";
import pigAfter from "@/assets/concerns/pig-after.jpg";
import pigBefore from "@/assets/concerns/pig-before.jpg";
import { ConcernStory } from "@/components/concerns/ConcernStory";
import { Testimonials } from "@/components/home/Testimonials";
import { VideoReviews } from "@/components/home/VideoReviews";
import { ImageReveal, Parallax, RevealOnScroll, TextReveal } from "@/components/motion/Reveal";
import { productImages } from "@/lib/product-images";
import { productService } from "@/services/productService";

const chapters = [
  { id: "pigmentation", label: "Pigmentation" },
  { id: "acne", label: "Acne" },
  { id: "hair", label: "Hair Care" },
] as const;
const supportImg = productImages("face-serum")[0];

const desc = "Scroll through pigmentation, acne and haircare stories, then explore Being You products for each area of care.";

export const Route = createFileRoute("/_site/explore-concerns")({
  head: () => ({
    meta: [
      { title: "Explore by Concern | Being You – Always" },
      { name: "description", content: desc },
      { property: "og:title", content: "Explore by Concern | Being You – Always" },
      { property: "og:description", content: desc },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async () => {
    const [pig, acne, hair] = await Promise.all([
      productService.byConcern("pigmentation"),
      productService.byConcern("acne-prone-skin"),
      productService.bySlugs(["hair-oil", "shampoo", "hair-mask"]),
    ]);
    return { pig, acne, hair };
  },
  component: ExploreConcerns,
});

function ExploreConcerns() {
  const { pig, acne, hair } = Route.useLoaderData();
  return (
    <>
      <header className="relative isolate overflow-hidden bg-page">
        <Parallax speed={-0.12} className="pointer-events-none absolute -left-24 top-10 -z-10"><span aria-hidden className="story-orb block size-72 rounded-full" /></Parallax>
        <Parallax speed={0.1} className="pointer-events-none absolute -right-16 bottom-0 -z-10"><span aria-hidden className="block size-96 rounded-full bg-sage/20 blur-3xl" /></Parallax>
        <div className="container-lux grid items-center gap-8 pb-12 pt-8 md:grid-cols-[1.05fr_1fr] md:gap-14 md:pb-16 md:pt-12 lg:gap-20 lg:pb-20">
          <div className="order-2 md:order-1">
            <RevealOnScroll as="p" kind="fade" className="eyebrow">Explore by concern</RevealOnScroll>
            <TextReveal as="h1" by="line" text={["Every Concern", <em key="e" className="text-primary">Has a Story.</em>]} className="mt-4 text-[2.9rem] leading-[0.98] sm:text-6xl md:text-7xl lg:text-[5.4rem]" delay={80} />
            <RevealOnScroll as="p" kind="fade" delay={320} className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground md:mt-6 md:text-base">
              Explore thoughtful beauty rituals through interactive stories of skin and hair care.
            </RevealOnScroll>
            <nav aria-label="Jump to concern" className="mt-7 grid grid-cols-3 gap-2 sm:gap-2.5 md:mt-9">
              {chapters.map(({ id, label }, i) => (
                <RevealOnScroll key={id} kind="fade-up" delay={420 + i * 90}>
                  <a href={`#${id}`} className="btn-motion btn-rise btn-fill group relative flex min-h-14 flex-col justify-center gap-0.5 rounded-xl border border-primary/20 bg-card/80 px-3 py-3 backdrop-blur hover:border-primary/60 [--btn-fill:color-mix(in_oklab,var(--primary)_6%,transparent)] lg:flex-row lg:items-center lg:justify-between lg:gap-3 lg:px-4">
                    <span className="flex flex-col gap-0.5 lg:flex-row lg:items-baseline lg:gap-2.5">
                      <span className="font-serif text-sm italic text-accent">0{i + 1}</span>
                      <span className="text-sm font-medium text-foreground">{label}</span>
                    </span>
                    <ArrowDown className="absolute right-3 top-3 size-3.5 text-primary lg:static lg:size-4 transition-transform duration-500 ease-[var(--ease-lux)] group-hover:translate-y-0.5" />
                  </a>
                </RevealOnScroll>
              ))}
            </nav>
            <RevealOnScroll kind="fade" delay={720} className="mt-8 hidden md:block">
              <a href="#pigmentation" className="group inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-primary">
                <span aria-hidden className="scroll-cue relative h-10 w-px overflow-hidden bg-border" />
                Scroll to begin the first story
              </a>
            </RevealOnScroll>
          </div>

          <div className="relative order-1 md:order-2">
            <ImageReveal className="rounded-[2rem] shadow-lift">
              <img src={pigAfter} alt="Editorial portrait of a woman with naturally radiant skin" width={1024} height={1280} fetchPriority="high" className="aspect-[5/4] w-full object-cover object-[50%_30%] md:aspect-auto md:h-[min(68vh,600px)]" />
            </ImageReveal>
            <Parallax speed={0.08} className="absolute -bottom-6 -left-4 w-[34%] md:-bottom-8 md:-left-10 md:w-[38%]">
              <ImageReveal from="left" delay={300} className="rounded-2xl border-[5px] border-background shadow-lift">
                <img src={supportImg} alt="Being You face serum among fresh botanicals" loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
              </ImageReveal>
            </Parallax>
            <RevealOnScroll kind="fade" delay={500} className="absolute right-3 top-3 md:right-5 md:top-5">
              <span className="inline-flex items-center gap-2 rounded-full bg-background/90 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground shadow-[var(--shadow-soft)] backdrop-blur">
                <span className="size-1.5 rounded-full bg-accent" /> 3 stories · scroll to explore
              </span>
            </RevealOnScroll>
          </div>
        </div>
      </header>

      <ConcernStory id="pigmentation" index={1} name="Pigmentation" before={pigBefore} after={pigAfter}
        beforeAlt="Illustrative portrait: woman with dark spots and uneven skin tone" afterAlt="The same woman with more even-looking skin tone"
        fromBg="var(--secondary)" toBg="color-mix(in oklab, var(--sage) 45%, var(--background))"
        moments={[
          { label: "The concern", title: "Dark spots and uneven tone.", copy: "Sun, time and everyday life can leave skin looking patchy. You're not alone in noticing it." },
          { label: "Understanding", title: "Why tone looks uneven.", copy: "Sun exposure and skin's natural response to it can show up as darker patches over time." },
          { label: "Everyday care", title: "A steady, gentle routine.", copy: "Cleanse, care and protect daily. Consistency matters more than intensity." },
          { label: "The reveal", title: "A more even-looking glow.", copy: "An illustration of what caring for your skin can feel like — every skin's journey is different." },
        ]}
        products={pig} ctaLabel="Explore relevant skincare" ctaTo="/skincare" />

      <ConcernStory id="acne" index={2} name="Acne" before={acneBefore} after={acneAfter}
        beforeAlt="Illustrative portrait: woman with visible red pimples on cheeks, chin and forehead" afterAlt="The same woman with clearer-looking skin"
        fromBg="color-mix(in oklab, var(--accent) 18%, var(--background))" toBg="color-mix(in oklab, var(--sage) 35%, var(--background))"
        moments={[
          { label: "The concern", title: "Breakouts that won't settle.", copy: "Redness and blemishes can make skin feel unpredictable." },
          { label: "Understanding", title: "Skin that needs a calmer routine.", copy: "Excess oil, clogged pores and touching your face can all play a part." },
          { label: "Everyday care", title: "Keep it clean and calm.", copy: "A gentle cleanse, light hydration and hands off — small habits, repeated." },
          { label: "The reveal", title: "Clearer-looking, calmer skin.", copy: "Illustrative only. Persistent acne is best discussed with a dermatologist." },
        ]}
        products={acne} ctaLabel="Shop skincare products" ctaTo="/skincare" />

      <ConcernStory id="hair" index={3} name="Hair Care" before={hairBefore} after={hairAfter} pos="60% 35%"
        beforeAlt="Woman holding a wooden comb after combing, with a noticeable clump of shed hair caught in its teeth" afterAlt="The same woman holding the same comb, with only a few loose strands in it"
        fromBg="color-mix(in oklab, var(--accent) 22%, var(--secondary))" toBg="color-mix(in oklab, var(--sage) 40%, var(--background))"
        moments={[
          { label: "The concern", title: "Hair fall, in every comb.", copy: "Hair shedding can be a frustrating part of an everyday routine." },
          { label: "Understanding", title: "Know what your hair needs.", copy: "Hair and scalp care begin with understanding your individual needs." },
          { label: "Everyday care", title: "Cleanse, condition, repeat.", copy: "Make thoughtful cleansing and conditioning part of your regular routine." },
          { label: "The reveal", title: "A ritual made for you.", copy: "Explore a haircare ritual designed around your everyday needs." },
        ]}
        products={hair} ctaLabel="Explore haircare collection" ctaTo="/haircare" />

      <Testimonials id="stories" />
      <VideoReviews />
    </>
  );
}
