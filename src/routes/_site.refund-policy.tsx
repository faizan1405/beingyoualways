import { createFileRoute } from "@tanstack/react-router";

import { ContentPage } from "@/components/site/ContentPage";

export const Route = createFileRoute("/_site/refund-policy")({
  head: () => ({
    meta: [
      { title: "Refund Policy | Being You – Always" },
      { name: "description", content: "Returns, exchanges and refunds at Being You – Always (draft)." },
      { property: "og:title", content: "Refund Policy | Being You – Always" },
      { property: "og:description", content: "Returns, exchanges and refunds at Being You – Always (draft)." },
    ],
  }),
  component: () => (
    <ContentPage eyebrow="Help" title="Refund Policy" draft>
      <h2>Eligibility</h2><p>Placeholder: which products can be returned and within how many days.</p><h2>Process</h2><p>Placeholder: how to request a return and how refunds are issued.</p>
    </ContentPage>
  ),
});
