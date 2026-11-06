import { createFileRoute } from "@tanstack/react-router";

import { PolicyPage } from "@/components/site/PolicyPage";

export const Route = createFileRoute("/_site/refund-policy")({
  head: () => ({
    meta: [
      { title: "Refund & Returns Policy | Being You – Always" },
      { name: "description", content: "Refund and returns information for Being You – Always. Migrated from the original Being You – Always website." },
      { property: "og:title", content: "Refund & Returns Policy | Being You – Always" },
      { property: "og:description", content: "Refund and returns information for Being You – Always. Migrated from the original Being You – Always website." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <PolicyPage title="Refund & Returns" policy="refund" />,
});
