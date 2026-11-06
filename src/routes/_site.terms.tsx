import { createFileRoute } from "@tanstack/react-router";

import { ContentPage } from "@/components/site/ContentPage";

export const Route = createFileRoute("/_site/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions | Being You – Always" },
      { name: "description", content: "Terms of use for the Being You – Always website (draft)." },
      { property: "og:title", content: "Terms & Conditions | Being You – Always" },
      { property: "og:description", content: "Terms of use for the Being You – Always website (draft)." },
    ],
  }),
  component: () => (
    <ContentPage eyebrow="Legal" title="Terms & Conditions" draft>
      <h2>Use of this website</h2><p>Placeholder terms of use.</p><h2>Orders & pricing</h2><p>Placeholder: pricing, availability and order acceptance.</p><h2>Governing law</h2><p>Placeholder.</p>
    </ContentPage>
  ),
});
