import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, CircleDashed, CircleDot } from "lucide-react";

import { AdminPage, Panel } from "@/components/admin/AdminUI";
import { buildApprovalChecklist, type ApprovalStatus } from "@/lib/approvals";
import { cn } from "@/lib/utils";
import { useAllProducts, useDemoStore } from "@/hooks/use-demo-store";
import { settingsStore } from "@/services/settingsService";
import { WHATSAPP_CONNECTED } from "@/services/whatsappService";
import { isPublic, testimonialStore } from "@/services/testimonialService";

export const Route = createFileRoute("/admin/approvals")({
  head: () => ({
    meta: [
      { title: "Client Approvals (Internal) | Being You – Always" },
      { name: "description", content: "Internal checklist of facts the client still needs to confirm before launch." },
      { property: "og:title", content: "Client Approvals | Being You – Always" },
      { property: "og:description", content: "Internal pre-launch approval checklist." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Approvals,
});

const STATUS: Record<ApprovalStatus, { label: string; I: typeof CheckCircle2; cls: string }> = {
  confirmed: { label: "Confirmed", I: CheckCircle2, cls: "bg-success/10 text-success" },
  partial: { label: "Partly done", I: CircleDot, cls: "bg-accent/15 text-foreground" },
  waiting: { label: "Waiting on client", I: CircleDashed, cls: "bg-destructive/10 text-destructive" },
};

function Approvals() {
  const products = useAllProducts();
  const reviews = useDemoStore(testimonialStore).filter(isPublic);
  const st = useDemoStore(settingsStore);
  const items = buildApprovalChecklist({
    products, publicReviewCount: reviews.length, whatsappApiConnected: WHATSAPP_CONNECTED,
    entered: { shippingFee: st.shipping.fee, shippingConfirmedByClient: st.shipping.clientConfirmed, cod: st.payments.cod, codConfirmedByClient: st.payments.clientConfirmed, whatsappNumber: st.whatsappNumber },
  });
  const done = items.filter((i) => i.status === "confirmed").length;

  return (
    <AdminPage title="Client approvals" subtitle="Internal checklist — not shown to shoppers. Each item updates automatically when the real information is added.">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm"><strong className="text-2xl font-serif">{done}</strong> of {items.length} confirmed</p>
          <div className="h-2 min-w-40 flex-1 overflow-hidden rounded-full bg-secondary sm:max-w-sm">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(done / items.length) * 100}%` }} />
          </div>
        </div>
      </Panel>
      <ol className="space-y-3">
        {items.map((it, n) => {
          const s = STATUS[it.status];
          return (
            <li key={it.id}>
              <Panel>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="font-serif text-2xl"><span className="mr-2 text-sm font-sans text-muted-foreground">{String(n + 1).padStart(2, "0")}</span>{it.title}</h2>
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", s.cls)}><s.I className="size-3.5" />{s.label}</span>
                </div>
                <dl className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                  <div><dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current status</dt><dd className="mt-1">{it.current}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Missing information</dt><dd className="mt-1">{it.status === "confirmed" ? "Nothing — confirmed." : it.needed}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Related products / pages</dt><dd className="mt-1">{it.affects}{it.pages?.length ? <span className="mt-1 block text-xs text-muted-foreground">Pages: {it.pages.join(", ")}</span> : null}</dd></div>
                </dl>
                {(it.missing?.length ?? 0) > 0 && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-xs font-medium text-primary">Show {it.missing!.length} product{it.missing!.length === 1 ? "" : "s"}</summary>
                    <ul className="mt-2 flex flex-wrap gap-1.5">{it.missing!.map((m) => <li key={m} className="rounded-full bg-secondary px-2.5 py-1 text-xs">{m}</li>)}</ul>
                  </details>
                )}
                {it.adminLink && <Link to={it.adminLink} className="mt-3 inline-block text-xs font-medium text-primary underline underline-offset-4">Open in admin</Link>}
              </Panel>
            </li>
          );
        })}
      </ol>
    </AdminPage>
  );
}
