import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DemoNotice({ children, className }: { children: ReactNode; className?: string | undefined}) {
  return (
    <div role="note" className={cn("flex items-start gap-2.5 rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-foreground", className)}>
      <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function SampleBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      Sample
    </span>
  );
}
