import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { ContentPage } from "@/components/site/ContentPage";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_site/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us | Being You – Always" },
      { name: "description", content: "Get in touch with the Being You – Always team." },
      { property: "og:title", content: "Contact Us | Being You – Always" },
      { property: "og:description", content: "Get in touch with our team." },
    ],
  }),
  component: Contact,
});

function Contact() {
  return (
    <ContentPage eyebrow="Help" title="Contact us">
      <p>Email: hello@example.com · WhatsApp: +91 XXXXX XXXXX (placeholders — awaiting client details)</p>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); toast("Thanks! Messages will be delivered once the backend is connected."); (e.target as HTMLFormElement).reset(); }}>
        {[["cname", "Name", "text"], ["cemail", "Email", "email"]].map(([id, l, t]) => (
          <div key={id}><label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider">{l}</label><input id={id} type={t} required className="h-12 w-full rounded-md border border-input bg-card px-4 text-sm text-foreground" /></div>
        ))}
        <div><label htmlFor="cmsg" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider">Message</label><textarea id="cmsg" required rows={5} className="w-full rounded-md border border-input bg-card p-4 text-sm text-foreground" /></div>
        <Button variant="lux" size="xl" type="submit">Send message</Button>
      </form>
    </ContentPage>
  );
}
