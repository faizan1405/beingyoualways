import { createFileRoute } from "@tanstack/react-router";

import { FaqList } from "@/components/home/FaqList";
import { ContentPage } from "@/components/site/ContentPage";

export const Route = createFileRoute("/_site/faq")({
  head: () => ({
    meta: [
      { title: "FAQs | Being You – Always" },
      { name: "description", content: "Answers to common questions about shopping with Being You – Always." },
      { property: "og:title", content: "FAQs | Being You – Always" },
      { property: "og:description", content: "Shopping questions answered." },
    ],
  }),
  component: () => (
    <ContentPage eyebrow="Help" title="Frequently asked questions">
      <p>Provisional answers — final details will be confirmed before launch.</p>
      <FaqList />
    </ContentPage>
  ),
});
