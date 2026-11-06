import { createFileRoute } from "@tanstack/react-router";

import { PolicyPage } from "@/components/site/PolicyPage";

export const Route = createFileRoute("/_site/disclaimer")({
  head: () => ({
    meta: [
      { title: "Disclaimer | Being You – Always" },
      { name: "description", content: "Website disclaimer for Being You – Always. Final wording pending client approval." },
      { property: "og:title", content: "Disclaimer | Being You – Always" },
      { property: "og:description", content: "Website disclaimer for Being You – Always. Final wording pending client approval." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <PolicyPage title="Disclaimer" originalPath="/disclaimer/" />,
});
