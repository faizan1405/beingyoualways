import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const faqs = [
  { q: "How long does delivery take?", a: "Orders are expected to dispatch within 2–4 working days, with delivery times varying by PIN code. (Provisional — to be confirmed.)" },
  { q: "Do you offer Cash on Delivery?", a: "Cash on Delivery is planned for eligible PIN codes once our checkout is live. (Provisional.)" },
  { q: "Can I return a product?", a: "Our return policy is being finalised. Please see the draft Refund Policy page for current guidance." },
  { q: "Are your products plant-based?", a: "Our range is formulated around plant-derived ingredients. Full ingredient lists are shown on every product page." },
  { q: "How do I track my order?", a: "Once live, you'll receive WhatsApp updates and can also track orders from My Account." },
];

export function FaqList({ items = faqs }: { items?: typeof faqs }) {
  return (
    <Accordion type="single" collapsible className="w-full">
      {items.map((f, i) => (
        <AccordionItem key={i} value={`f${i}`}>
          <AccordionTrigger className="py-5 text-left font-serif text-xl font-normal hover:no-underline">{f.q}</AccordionTrigger>
          <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
