import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AdminPage({ title, subtitle, actions, children }: { title: string; subtitle?: string | undefined; actions?: ReactNode | undefined; children: ReactNode }) {
  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

export function Panel({ title, children, className, action }: { title?: string | undefined; children: ReactNode; className?: string | undefined; action?: ReactNode | undefined}) {
  return (
    <section className={cn("rounded-xl border border-border bg-card p-5 shadow-soft", className)}>
      {title && <div className="mb-4 flex items-center justify-between"><h2 className="font-sans text-sm font-semibold uppercase tracking-wider">{title}</h2>{action}</div>}
      {children}
    </section>
  );
}

export function NotConnected({ label = "WhatsApp API Not Connected" }: { label?: string | undefined}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
      <span className="size-2 rounded-full bg-destructive" />{label}
    </span>
  );
}

export const adminInput = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary";
export const adminLabel = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">{head.map((h) => <th key={h} className="px-3 py-3 font-semibold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className }: { children: ReactNode; className?: string | undefined}) => <td className={cn("px-3 py-3", className)}>{children}</td>;
