import { createFileRoute } from "@tanstack/react-router";
import { History, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AdminPage, NotConnected, Panel, Table, Td, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Pill } from "@/components/shop/OrderBadges";
import { Button } from "@/components/ui/button";
import { useDemoStore } from "@/hooks/use-demo-store";
import type { CampaignSegment, WhatsAppCampaign } from "@/lib/types";
import { customerStore } from "@/services/customerService";
import { orderStore } from "@/services/orderService";
import { CAMPAIGN_TEMPLATES, SEGMENTS, campaignStore, fillTemplate, segmentSize, validateCampaign, whatsappService } from "@/services/whatsappService";

export const Route = createFileRoute("/admin/whatsapp")({ component: WhatsApp });

interface Form { id?: string | undefined; name: string; template: string; body: string; segment: CampaignSegment; scheduledFor: string }
const empty = (): Form => ({ name: "", template: CAMPAIGN_TEMPLATES[0]!, body: "", segment: "all", scheduledFor: "" });

const STARTERS: { label: string; body: string }[] = [
  { label: "New launch", body: "Hi {name}, something new just arrived at Being You – Always 🌿 Take a look: {store_url}" },
  { label: "Back in stock", body: "Hi {name}, a favourite is available again. Shop here: {store_url}" },
  { label: "We miss you", body: "Hi {name}, it's been a while! Your skin & hair rituals are waiting: {store_url}" },
];

function WhatsApp() {
  const campaigns = useDemoStore(campaignStore);
  const customers = useDemoStore(customerStore);
  const orders = useDemoStore(orderStore);
  const carts = whatsappService.abandonedCarts();
  const [f, setF] = useState<Form>(empty);
  const [del, setDel] = useState<WhatsAppCampaign | null>(null);
  const [historyOf, setHistoryOf] = useState<string | null>(null);
  const preview = fillTemplate(f.body || "Your message will appear here.", { name: "Riya", store_url: "beingyoualways.com" });
  const reach = segmentSize(f.segment, customers, orders, carts);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errors = validateCampaign(f);
    if (errors.length) { toast.error(errors[0]!); return; }
    whatsappService.saveCampaign({ id: f.id, name: f.name.trim(), template: f.template, body: f.body.trim(), segment: f.segment, scheduledFor: f.scheduledFor || undefined });
    toast(f.scheduledFor ? "Saved as a scheduled simulation — nothing will be sent (API not connected)" : "Saved as draft — nothing will be sent (API not connected)");
    setF(empty());
  };

  return (
    <AdminPage title="WhatsApp Campaigns" actions={<NotConnected />} subtitle="Draft and plan campaigns. Nothing is sent from this prototype, so there are no delivery or read figures.">
      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <Panel title={f.id ? "Edit campaign" : "Create campaign"} action={f.id ? <Button size="sm" variant="outline" onClick={() => setF(empty())}><Plus /> New</Button> : undefined}>
          <form className="space-y-3" onSubmit={submit} noValidate>
            <div><label htmlFor="cn" className={adminLabel}>Campaign name</label><input id="cn" className={adminInput} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="ct" className={adminLabel}>Template name</label><select id="ct" className={adminInput} value={f.template} onChange={(e) => setF({ ...f, template: e.target.value })}>{CAMPAIGN_TEMPLATES.map((t) => <option key={t}>{t}</option>)}</select></div>
              <div><label htmlFor="cs" className={adminLabel}>Customer segment</label><select id="cs" className={adminInput} value={f.segment} onChange={(e) => setF({ ...f, segment: e.target.value as CampaignSegment })}>{SEGMENTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></div>
            </div>
            <p className="text-[11px] text-muted-foreground">{SEGMENTS.find((s) => s.key === f.segment)?.hint} — {reach} demo contact{reach === 1 ? "" : "s"} today.</p>
            <div>
              <div className="flex items-center justify-between"><label htmlFor="cb" className={adminLabel}>Message</label><span className="text-[10px] text-muted-foreground">{f.body.length}/1024</span></div>
              <textarea id="cb" rows={5} maxLength={1024} className={`${adminInput} h-auto py-2`} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="Hi {name}, …" />
              <div className="mt-1 flex flex-wrap gap-1.5">{STARTERS.map((s) => <button key={s.label} type="button" className="rounded-full border border-input px-2 py-0.5 text-[11px] hover:border-primary" onClick={() => setF({ ...f, body: s.body })}>{s.label}</button>)}</div>
              <p className="mt-1 text-[11px] text-muted-foreground">Variables: {"{name}"}, {"{store_url}"}. Final wording must match a template approved by WhatsApp.</p>
            </div>
            <div><label htmlFor="cw" className={adminLabel}>Schedule (optional, simulation)</label><input id="cw" type="datetime-local" className={adminInput} value={f.scheduledFor} onChange={(e) => setF({ ...f, scheduledFor: e.target.value })} /></div>
            <Button variant="lux" size="xl" className="w-full" type="submit">{f.id ? "Save changes" : "Save campaign"}</Button>
          </form>
        </Panel>
        <div className="space-y-4">
          <Panel title="Preview">
            <div className="rounded-xl bg-sage/25 p-5">
              <div className="ml-auto max-w-[85%] whitespace-pre-line rounded-lg rounded-tr-none bg-card p-3 text-sm shadow-soft">{preview}<p className="mt-1 text-right text-[10px] text-muted-foreground">Preview · not sent</p></div>
            </div>
          </Panel>
          <Panel title={`Campaigns (${campaigns.length})`}>
            {campaigns.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No campaigns yet. Drafts you save appear here.</p> : (
              <Table head={["Name", "Segment", "Schedule", "Status", ""]}>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <Td className="font-semibold">{c.name}<div className="text-xs font-normal text-muted-foreground">{c.template}</div></Td>
                    <Td>{SEGMENTS.find((s) => s.key === c.segment)?.label}</Td>
                    <Td>{c.scheduledFor ? c.scheduledFor.replace("T", " ") : "—"}</Td>
                    <Td><Pill t={c.status === "scheduled" ? "info" : "muted"}>{c.status === "scheduled" ? "scheduled (simulated)" : "draft"}</Pill></Td>
                    <Td className="whitespace-nowrap text-right">
                      <Button variant="ghost" size="icon" aria-label={`History of ${c.name}`} onClick={() => setHistoryOf(historyOf === c.id ? null : c.id)}><History /></Button>
                      <Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`} onClick={() => setF({ id: c.id, name: c.name, template: c.template, body: c.body, segment: c.segment, scheduledFor: c.scheduledFor ?? "" })}><Pencil /></Button>
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
