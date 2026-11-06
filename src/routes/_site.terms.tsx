import { createFileRoute } from "@tanstack/react-router";

import { PolicyPage } from "@/components/site/PolicyPage";

export const Route = createFileRoute("/_site/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions | Being You – Always" },
      { name: "description", content: "Terms for using the Being You – Always website. Final terms pending client approval." },
      { property: "og:title", content: "Terms & Conditions | Being You – Always" },
      { property: "og:description", content: "Terms for using the Being You – Always website. Final terms pending client approval." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <PolicyPage title="Terms & Conditions" originalPath="/terms-of-service/" />,
});
