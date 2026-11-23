import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useSiteContent } from "@/hooks/use-demo-store";

export { faqs } from "@/content/faqs";

/** FAQ accordion. Defaults to the FAQs edited in Admin → Website content. */
export function FaqList({ items, limit }: { items?: { q: string; a: string }[] | undefined; limit?: number | undefined }) {
  const content = useSiteContent();
  const list = (items ?? content.faqs).slice(0, limit);
  return (
    <Accordion type="single" collapsible className="w-full">
      {list.map((f, i) => (
        <AccordionItem key={i} value={`f${i}`}>
          <AccordionTrigger className="py-5 text-left font-serif text-xl font-normal hover:no-underline">{f.q}</AccordionTrigger>
          <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
