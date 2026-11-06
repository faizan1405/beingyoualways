import { createFileRoute } from "@tanstack/react-router";

import { PolicyPage } from "@/components/site/PolicyPage";

export const Route = createFileRoute("/_site/shipping-policy")({
  head: () => ({
    meta: [
      { title: "Shipping Policy | Being You – Always" },
      { name: "description", content: "How Being You – Always orders are shipped. Final policy pending client approval." },
      { property: "og:title", content: "Shipping Policy | Being You – Always" },
      { property: "og:description", content: "How Being You – Always orders are shipped. Final policy pending client approval." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <PolicyPage title="Shipping Policy" originalPath="/shipping-policy/" />,
});
