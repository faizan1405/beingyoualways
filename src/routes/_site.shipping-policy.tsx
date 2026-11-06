import { createFileRoute } from "@tanstack/react-router";

import { ContentPage } from "@/components/site/ContentPage";

export const Route = createFileRoute("/_site/shipping-policy")({
  head: () => ({
    meta: [
      { title: "Shipping Policy | Being You – Always" },
      { name: "description", content: "Shipping timelines and charges for Being You – Always orders (draft)." },
      { property: "og:title", content: "Shipping Policy | Being You – Always" },
      { property: "og:description", content: "Shipping timelines and charges for Being You – Always orders (draft)." },
    ],
  }),
  component: () => (
    <ContentPage eyebrow="Help" title="Shipping Policy" draft>
      <h2>Dispatch</h2><p>Placeholder: orders dispatch within 2–4 working days.</p><h2>Charges</h2><p>Placeholder: free shipping above ₹999; ₹79 below that (sample values).</p><h2>Delivery areas</h2><p>Placeholder: serviceable PIN codes and COD availability.</p>
    </ContentPage>
  ),
});
