import { Link } from "@tanstack/react-router";
import { CheckCircle2, CircleDashed } from "lucide-react";

import { AdminPage, Panel } from "@/components/admin/AdminUI";
import { cn } from "@/lib/utils";
import { adminContent } from "@/services/adminContentService";
import { LiveState, useLive } from "./shared";

/** Where each checklist item is fixed in the admin. */
const LINKS: Record<string, "/admin/settings" | "/admin/products" | "/admin/testimonials" | "/admin/content"> = {
  shipping: "/admin/settings",
  cod: "/admin/settings",
  razorpay: "/admin/settings",
  email: "/admin/settings",
  google: "/admin/settings",
  store: "/admin/settings",
  products: "/admin/products",
  media: "/admin/products",
  stories: "/admin/testimonials",
  content: "/admin/content",
};

/** The pre-launch checklist, computed on the server from live data — nothing here is ticked by hand. */
export function LiveApprovals() {
  const { data, error, loading, reload } = useLive(() => adminContent.approvals(), []);
  if (!data) return <AdminPage title="Client approvals"><LiveState error={error} loading={loading} onRetry={() => void reload()} /></AdminPage>;

  return (
    <AdminPage title="Client approvals" subtitle="Internal checklist — not shown to shoppers. Each item is worked out from the live database and turns confirmed only when the fact behind it exists."
      actions={<button type="button" onClick={() => void reload()} className="text-xs font-medium text-primary underline underline-offset-4">Re-check now</button>}>
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm"><strong className="text-2xl font-serif">{data.confirmed}</strong> of {data.total} confirmed</p>
          <div className="h-2 min-w-40 flex-1 overflow-hidden rounded-full bg-secondary sm:max-w-sm">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(data.confirmed / data.total) * 100}%` }} />
          </div>
        </div>
      </Panel>
      <ol className="space-y-3">
        {data.items.map((it, n) => (
          <li key={it.key}>
            <Panel>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="font-serif text-2xl"><span className="mr-2 text-sm font-sans text-muted-foreground">{String(n + 1).padStart(2, "0")}</span>{it.label}</h2>
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", it.confirmed ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                  {it.confirmed ? <CheckCircle2 className="size-3.5" /> : <CircleDashed className="size-3.5" />}
                  {it.confirmed ? "Confirmed" : "Waiting"}
                </span>
              </div>
              <p className="mt-3 text-sm">{it.detail}</p>
              {!it.confirmed && LINKS[it.key] && <Link to={LINKS[it.key]!} className="mt-3 inline-block text-xs font-medium text-primary underline underline-offset-4">Open in admin</Link>}
            </Panel>
          </li>
        ))}
      </ol>
    </AdminPage>
  );
}
