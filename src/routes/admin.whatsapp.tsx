import { Link, createFileRoute } from "@tanstack/react-router";
import { History, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AdminPage, NotConnected, Panel, Table, Td, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Pill } from "@/components/shop/OrderBadges";
import { Button } from "@/components/ui/button";
import { useDemoStore } from "@/hooks/use-demo-store";
import type { CampaignSegment, WhatsAppCampaign } from "@/lib/types";
import { checkSendingLimit, fillPositional, templateByName } from "@/lib/whatsapp-cloud";
import { customerStore } from "@/services/customerService";
import { orderStore } from "@/services/orderService";
import { CAMPAIGN_TEMPLATES, SEGMENTS, campaignStore, segmentRecipients, validateCampaign, whatsappService } from "@/services/whatsappService";
import { LiveCampaigns } from "@/components/admin/live/LiveCampaigns";
import { isBackendConfigured } from "@/services/api";

export const Route = createFileRoute("/admin/whatsapp")({ component: () => (isBackendConfigured() ? <LiveCampaigns /> : <WhatsApp />) });

interface Form { id?: string | undefined; name: string; template: string; segment: CampaignSegment; scheduledFor: string }
const empty = (): Form => ({ name: "", template: CAMPAIGN_TEMPLATES[0] ?? "", segment: "all", scheduledFor: "" });

/** What each template variable is filled with, and the sample used in the preview. */
const FIELD: Record<string, { label: string; sample: string }> = {
  name: { label: "Customer's first name", sample: "Riya" },
  store_url: { label: "Shop link", sample: "beingyoualways.com" },
};

function WhatsApp() {
  const campaigns = useDemoStore(campaignStore);
  const customers = useDemoStore(customerStore);
  const orders = useDemoStore(orderStore);
  const carts = whatsappService.abandonedCarts();
  const [f, setF] = useState<Form>(empty);
  const [del, setDel] = useState<WhatsAppCampaign | null>(null);
  const [historyOf, setHistoryOf] = useState<string | null>(null);
  const tpl = templateByName(f.template);
  const preview = tpl ? fillPositional(tpl.body, tpl.variables.map((v) => FIELD[v]?.sample ?? v)) : "Choose a template.";
  const reach = segmentRecipients(f.segment, customers, orders, carts);
  const limit = checkSendingLimit(reach.eligibleCount, null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!tpl) { toast.error("Choose a template."); return; }
    const errors = validateCampaign({ name: f.name, body: tpl.body, scheduledFor: f.scheduledFor || undefined });
    if (errors.length) { toast.error(errors[0]!); return; }
    whatsappService.saveCampaign({ id: f.id, name: f.name.trim(), template: tpl.name, body: tpl.body, variables: tpl.variables, segment: f.segment, scheduledFor: f.scheduledFor || undefined });
    toast(f.scheduledFor ? "Saved with a planned time — nothing will be sent (WhatsApp API not connected)" : "Saved as draft — nothing will be sent (WhatsApp API not connected)");
    setF(empty());
  };

  return (
    <AdminPage title="WhatsApp Campaigns" actions={<NotConnected />} subtitle="Plan campaigns using Meta-approved templates. Campaigns are never sent automatically — an admin must schedule each one on the live server. Nothing has been sent, so there are no delivery figures.">
      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <Panel title={f.id ? "Edit campaign" : "Create campaign"} action={f.id ? <Button size="sm" variant="outline" onClick={() => setF(empty())}><Plus /> New</Button> : undefined}>
          <form className="space-y-3" onSubmit={submit} noValidate>
            <div><label htmlFor="cn" className={adminLabel}>Campaign name</label><input id="cn" className={adminInput} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="ct" className={adminLabel}>Template</label><select id="ct" className={adminInput} value={f.template} onChange={(e) => setF({ ...f, template: e.target.value })}>{CAMPAIGN_TEMPLATES.map((t) => <option key={t}>{t}</option>)}</select></div>
              <div><label htmlFor="cs" className={adminLabel}>Customer segment</label><select id="cs" className={adminInput} value={f.segment} onChange={(e) => setF({ ...f, segment: e.target.value as CampaignSegment })}>{SEGMENTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></div>
            </div>
            <p className="text-[11px] text-muted-foreground">Template approval: <strong>not checked</strong> — it can be sent only once Meta approves it (<Link to="/admin/whatsapp-api" className="underline">see templates</Link>).</p>
            {tpl && (
              <div className="rounded-md bg-secondary/60 p-3 text-xs">
                <p className={adminLabel}>Personalised variables</p>
                <ul className="space-y-0.5">{tpl.variables.map((v, i) => <li key={v}><span className="font-mono">{`{{${i + 1}}}`}</span> → {FIELD[v]?.label ?? v}</li>)}</ul>
              </div>
            )}
            <div className="rounded-md border border-border p-3 text-xs">
              <p className="font-semibold">{SEGMENTS.find((s) => s.key === f.segment)?.hint}</p>
              <p className="mt-1"><strong>{reach.eligibleCount}</strong> can receive it (opted in, valid number) · {reach.optedOut} opted out · {reach.notAsked} never asked{reach.noNumber ? ` · ${reach.noNumber} without a usable number` : ""}</p>
              <p className="mt-1 text-muted-foreground">{limit.message}</p>
            </div>
            <div><label htmlFor="cw" className={adminLabel}>Planned send time (optional)</label><input id="cw" type="datetime-local" className={adminInput} value={f.scheduledFor} onChange={(e) => setF({ ...f, scheduledFor: e.target.value })} /></div>
            <Button variant="lux" size="xl" className="w-full" type="submit">{f.id ? "Save changes" : "Save campaign"}</Button>
          </form>
        </Panel>
        <div className="space-y-4">
          <Panel title="Preview">
            <div className="rounded-xl bg-sage/25 p-5">
              <div className="ml-auto max-w-[85%] whitespace-pre-line rounded-lg rounded-tr-none bg-card p-3 text-sm shadow-soft">{preview}<p className="mt-1 text-right text-[10px] text-muted-foreground">Preview with sample values · not sent</p></div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Every marketing message ends with “Reply STOP to opt out”. A STOP reply marks the customer opted out automatically (via the server's webhook).</p>
          </Panel>
          <Panel title={`Campaigns (${campaigns.length})`}>
            {campaigns.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No campaigns yet. Drafts you save appear here.</p> : (
              <Table head={["Name", "Segment", "Planned", "Status", "Delivery report", ""]}>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <Td className="font-semibold">{c.name}<div className="font-mono text-xs font-normal text-muted-foreground">{c.template}</div></Td>
                    <Td>{SEGMENTS.find((s) => s.key === c.segment)?.label}</Td>
                    <Td>{c.scheduledFor ? c.scheduledFor.replace("T", " ") : "—"}</Td>
                    <Td><Pill t={c.status === "scheduled" ? "info" : "muted"}>{c.status === "scheduled" ? "planned · not sent" : "draft"}</Pill></Td>
                    <Td className="text-xs text-muted-foreground">None — not sent</Td>
                    <Td className="whitespace-nowrap text-right">
                      <Button variant="ghost" size="icon" aria-label={`History of ${c.name}`} onClick={() => setHistoryOf(historyOf === c.id ? null : c.id)}><History /></Button>
                      <Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`} onClick={() => setF({ id: c.id, name: c.name, template: CAMPAIGN_TEMPLATES.includes(c.template) ? c.template : (CAMPAIGN_TEMPLATES[0] ?? ""), segment: c.segment, scheduledFor: c.scheduledFor ?? "" })}><Pencil /></Button>
                      <Button variant="ghost" size="icon" aria-label={`Delete ${c.name}`} onClick={() => setDel(c)}><Trash2 className="text-destructive" /></Button>
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>
          {historyOf && (
            <Panel title="Campaign history">
              <ol className="space-y-2 text-sm">{campaigns.find((c) => c.id === historyOf)?.history.slice().reverse().map((h, i) => <li key={i} className="flex justify-between gap-4"><span>{h.label}</span><span className="shrink-0 text-xs text-muted-foreground">{new Date(h.at).toLocaleString("en-IN")}</span></li>)}</ol>
            </Panel>
          )}
        </div>
      </div>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Delete “${del?.name ?? ""}”?`} confirmLabel="Delete" description="The draft and its history are removed from this browser." onConfirm={() => { if (del) { whatsappService.removeCampaign(del.id); toast("Campaign deleted"); } }} />
    </AdminPage>
  );
}
