import { createFileRoute } from "@tanstack/react-router";

import acneAfter from "@/assets/concerns/acne-after.jpg";
import acneBefore from "@/assets/concerns/acne-before.jpg";
import hairAfter from "@/assets/concerns/hair-after.jpg";
import hairBefore from "@/assets/concerns/hair-before.jpg";
import pigAfter from "@/assets/concerns/pig-after.jpg";
import pigBefore from "@/assets/concerns/pig-before.jpg";
import { ConcernStory, DISCLOSURE } from "@/components/concerns/ConcernStory";
import { productService } from "@/services/productService";

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
      <header className="container-lux py-16 text-center md:py-24">
        <p className="eyebrow">Explore by concern</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-5xl leading-[1.02] md:text-7xl">Care stories, told as you scroll.</h1>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">Three everyday concerns, three gentle rituals. Keep scrolling to watch each story unfold.</p>
        <nav aria-label="Jump to concern" className="mt-8 flex flex-wrap justify-center gap-2">
          {[["pigmentation", "Pigmentation"], ["acne", "Acne"], ["hair", "Hair Care"]].map(([id, l]) => (
            <a key={id} href={`#${id}`} className="rounded-full border border-border px-5 py-2 text-sm transition-colors hover:bg-secondary">{l}</a>
          ))}
        </nav>
        <p className="mx-auto mt-6 max-w-md text-xs text-muted-foreground">{DISCLOSURE}</p>
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

      <ConcernStory id="hair" index={3} name="Hair Care" before={hairBefore} after={hairAfter} pos="50% 30%"
        beforeAlt="Illustrative portrait: woman with dry, frizzy, dull-looking long hair" afterAlt="The same woman with smoother, shinier-looking hair"
        fromBg="color-mix(in oklab, var(--accent) 22%, var(--secondary))" toBg="color-mix(in oklab, var(--sage) 40%, var(--background))"
        moments={[
          { label: "The concern", title: "Dry, frizzy, dull.", copy: "Heat, hard water and weather can leave hair rough and hard to manage." },
          { label: "Understanding", title: "Hair that's asking for moisture.", copy: "When strands lose moisture, the surface roughens — and shine and smoothness fade." },
          { label: "Everyday care", title: "Oil, wash, nourish.", copy: "A weekly oiling ritual, a gentle wash and a mask when hair needs extra care." },
          { label: "The reveal", title: "Smoother, more manageable hair.", copy: "An illustration of everyday haircare — not a promise of regrowth or treatment." },
        ]}
        products={hair} ctaLabel="Explore haircare collection" ctaTo="/haircare" />
    </>
  );
}
