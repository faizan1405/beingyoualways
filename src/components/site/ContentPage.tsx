import type { ReactNode } from "react";

import { DemoNotice } from "@/components/shop/DemoNotice";

export function ContentPage({ eyebrow, title, draft, children }: { eyebrow: string; title: string; draft?: boolean; children: ReactNode }) {
  return (
    <article className="container-lux max-w-3xl py-16 md:py-24">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-3 text-5xl md:text-6xl">{title}</h1>
      {draft && <DemoNotice className="mt-6">Draft placeholder — this page will be replaced with the client's approved legal content.</DemoNotice>}
      <div className="mt-10 space-y-5 text-[15px] leading-relaxed text-muted-foreground [&_h2]:mt-10 [&_h2]:text-3xl [&_h2]:text-foreground">{children}</div>
    </article>
  );
}
