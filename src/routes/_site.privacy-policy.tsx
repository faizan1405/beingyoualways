import { createFileRoute } from "@tanstack/react-router";

import { PolicyPage } from "@/components/site/PolicyPage";

export const Route = createFileRoute("/_site/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | Being You – Always" },
      { name: "description", content: "How Being You – Always handles your personal information. Final policy pending client approval." },
      { property: "og:title", content: "Privacy Policy | Being You – Always" },
      { property: "og:description", content: "How Being You – Always handles your personal information. Final policy pending client approval." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <PolicyPage title="Privacy Policy" originalPath="/privacy-policy/" />,
});
