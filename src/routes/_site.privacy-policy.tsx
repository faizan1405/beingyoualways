import { createFileRoute } from "@tanstack/react-router";

import { ContentPage } from "@/components/site/ContentPage";

export const Route = createFileRoute("/_site/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | Being You – Always" },
      { name: "description", content: "How Being You – Always handles your personal information (draft)." },
      { property: "og:title", content: "Privacy Policy | Being You – Always" },
      { property: "og:description", content: "How Being You – Always handles your personal information (draft)." },
    ],
  }),
  component: () => (
    <ContentPage eyebrow="Legal" title="Privacy Policy" draft>
      <h2>Information we collect</h2><p>Placeholder: describe the personal data collected (name, contact, address, order history).</p><h2>How we use it</h2><p>Placeholder: order fulfilment, WhatsApp updates you opt into, customer support.</p><h2>Your choices</h2><p>Placeholder: how customers can access, correct or delete their data.</p>
    </ContentPage>
  ),
});
