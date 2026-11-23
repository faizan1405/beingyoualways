import { Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AdminPage, Panel, Table, Td, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { productService } from "@/services/productService";
import { whatsappLive, type Campaign, type CampaignInput, type MetaTemplateRow, type Segment } from "@/services/whatsappLiveService";
import { LiveState, istDateTime, useLive } from "./shared";

const SEGMENT_TEXT = (s: Segment, cats: { slug: string; name: string }[]) =>
  s.kind === "all_opted_in" ? "Everyone who agreed to offers" : s.kind === "has_ordered" ? "Customers who have ordered"
  : s.kind === "no_order_days" ? `No order in the last ${s.days} days` : `Bought from ${cats.find((c) => c.slug === s.category)?.name ?? s.category}`;
const STATUS_TEXT: Record<Campaign["status"], string> = { DRAFT: "Draft — nothing sent", APPROVED: "Approved", COMPLETED: "Finished", CANCELLED: "Cancelled" };

const emptyForm = (): CampaignInput => ({ name: "", templateName: "", language: "en", segment: { kind: "all_opted_in" }, params: [], scheduledAt: null, maxRecipients: 500 });
const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(0, 16) : "");

/** Marketing campaigns: drafts send nothing; only the owner's explicit approval of the exact audience queues them. */
export function LiveCampaigns() {
  const list = useLive(() => whatsappLive.campaigns(), []);
  const tpl = useLive(() => whatsappLive.templates(), []);
  const [cats, setCats] = useState<{ slug: string; name: string }[]>([]);
  const [catsError, setCatsError] = useState<string | null>(null);
  useEffect(() => {
    productService.categories()
      .then((c) => { setCats(c.map(({ slug, name }) => ({ slug, name }))); setCatsError(null); })
      .catch((e) => setCatsError(e instanceof Error ? e.message : "Categories couldn't be loaded."));
  }, []);
  const [editing, setEditing] = useState<{ id: string | null; f: CampaignInput } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const marketing = (tpl.data?.templates ?? []).filter((t) => t.category === "MARKETING" && t.status === "APPROVED");
  const chosen: MetaTemplateRow | undefined = marketing.find((t) => t.name === editing?.f.templateName && t.language === editing?.f.language);
  const setF = (p: Partial<CampaignInput>) => setEditing((e) => (e ? { ...e, f: { ...e.f, ...p } } : e));

  const save = async (e: FormEvent) => {
    e.preventDefault(); if (!editing) return;
    setBusy(true);
    try {
      const c = editing.id ? await whatsappLive.updateCampaign(editing.id, editing.f) : await whatsappLive.createCampaign(editing.f);
      toast("Draft saved — nothing has been sent"); setEditing(null); setOpenId(c.id); await list.reload();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Not saved."); } finally { setBusy(false); }
  };

  return (
    <AdminPage title="WhatsApp campaigns" subtitle="Offers go only to customers who agreed to WhatsApp offers. Saving a draft never sends anything."
      actions={!editing && <Button variant="lux" onClick={() => setEditing({ id: null, f: emptyForm() })}><Plus className="size-4" /> New campaign</Button>}>
      <div className="space-y-6">
        {editing && (
          <Panel title={editing.id ? "Edit draft" : "New campaign"}>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={save}>
              <div><label htmlFor="c-name" className={adminLabel}>Name (only for you)</label><input id="c-name" className={adminInput} value={editing.f.name} onChange={(e) => setF({ name: e.target.value })} required minLength={3} maxLength={120} /></div>
              <div>
                <label htmlFor="c-tpl" className={adminLabel}>Approved marketing template</label>
                <select id="c-tpl" className={adminInput} value={`${editing.f.templateName}|${editing.f.language}`} required
                  onChange={(e) => { const [name = "", language = "en"] = e.target.value.split("|"); const t = marketing.find((x) => x.name === name && x.language === language); setF({ templateName: name, language, params: Array.from({ length: t?.variables ?? 0 }, (_, i) => editing.f.params[i] ?? (i === 0 ? "{name}" : "")) }); }}>
                  <option value="|en">Choose…</option>
                  {marketing.map((t) => <option key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>{t.name} ({t.language})</option>)}
                </select>
                {tpl.data && marketing.length === 0 && <p className="mt-1 text-xs text-destructive">No approved marketing templates yet. Create one in WhatsApp Manager and wait for Meta's approval.</p>}
                {tpl.error && <p className="mt-1 text-xs text-destructive">{tpl.error}</p>}
              </div>
              {chosen && chosen.variables > 0 && (
                <div className="md:col-span-2">
                  <p className={adminLabel}>Template variables</p>
                  <p className="mb-2 text-xs text-muted-foreground">Type <code>{"{name}"}</code> for the customer's first name or <code>{"{store_url}"}</code> for the shop link.</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Array.from({ length: chosen.variables }, (_, i) => <input key={i} aria-label={`Variable ${i + 1}`} className={adminInput} placeholder={`{{${i + 1}}}`} value={editing.f.params[i] ?? ""} required maxLength={200}
                      onChange={(e) => setF({ params: Array.from({ length: chosen.variables }, (_, j) => (j === i ? e.target.value : editing.f.params[j] ?? "")) })} />)}
                  </div>
                </div>
              )}
              <div>
                <label htmlFor="c-seg" className={adminLabel}>Who receives it</label>
                <select id="c-seg" className={adminInput} value={editing.f.segment.kind} onChange={(e) => {
                  const k = e.target.value as Segment["kind"];
                  setF({ segment: k === "no_order_days" ? { kind: k, days: 90 } : k === "bought_category" ? { kind: k, category: cats[0]?.slug ?? "" } : { kind: k } });
                }}>
                  <option value="all_opted_in">Everyone who agreed to offers</option><option value="has_ordered">Customers who have ordered</option>
                  <option value="no_order_days">No order for a while</option><option value="bought_category">Bought from a category</option>
                </select>
                {editing.f.segment.kind === "no_order_days" && <input aria-label="Days without an order" type="number" min={7} max={730} className={`${adminInput} mt-2`} value={editing.f.segment.days} onChange={(e) => setF({ segment: { kind: "no_order_days", days: Number(e.target.value) } })} />}
                {editing.f.segment.kind === "bought_category" && <select aria-label="Category" className={`${adminInput} mt-2`} value={editing.f.segment.category} onChange={(e) => setF({ segment: { kind: "bought_category", category: e.target.value } })}>{cats.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>}
                {editing.f.segment.kind === "bought_category" && catsError && <p role="alert" className="mt-1 text-xs text-destructive">{catsError} Reload the page to pick a category.</p>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label htmlFor="c-when" className={adminLabel}>Send at (India time, optional)</label><input id="c-when" type="datetime-local" className={adminInput} value={toLocal(editing.f.scheduledAt)} onChange={(e) => setF({ scheduledAt: e.target.value ? `${e.target.value}:00+05:30` : null })} /></div>
                <div><label htmlFor="c-max" className={adminLabel}>At most</label><input id="c-max" type="number" min={1} max={10000} className={adminInput} value={editing.f.maxRecipients} onChange={(e) => setF({ maxRecipients: Number(e.target.value) })} /></div>
              </div>
              <div className="flex justify-end gap-2 md:col-span-2"><Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" variant="lux" disabled={busy}>Save draft</Button></div>
            </form>
          </Panel>
        )}
        {openId && <CampaignDetail id={openId} cats={cats} onClose={() => setOpenId(null)} onChanged={() => void list.reload()} onEdit={(c) => { setOpenId(null); setEditing({ id: c.id, f: { name: c.name, templateName: c.templateName, language: c.language, segment: c.segment, params: c.params, scheduledAt: c.scheduledAt, maxRecipients: c.maxRecipients } }); }} />}
        <Panel title="Campaigns">
          {!list.data ? <LiveState error={list.error} loading={list.loading} onRetry={() => void list.reload()} /> : list.data.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No campaigns yet.</p> : (
            <Table head={["Campaign", "Audience", "Status", "Report (from Meta)", ""]}>
              {list.data.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <Td><span className="font-medium">{c.name}</span><span className="block font-mono text-xs text-muted-foreground">{c.templateName}</span></Td>
                  <Td className="text-xs">{SEGMENT_TEXT(c.segment, cats)}{c.recipientCount != null ? ` · ${c.recipientCount} recipients` : ""}</Td>
                  <Td className="text-xs">{STATUS_TEXT[c.status]}{c.scheduledAt && c.status === "APPROVED" ? <span className="block text-muted-foreground">from {istDateTime(c.scheduledAt)}</span> : null}</Td>
                  <Td className="text-xs">{c.status === "DRAFT" ? "—" : `${c.report.accepted + c.report.sent + c.report.delivered + c.report.read} accepted · ${c.report.delivered + c.report.read} delivered · ${c.report.read} read · ${c.report.failed} failed · ${c.report.queued} waiting`}</Td>
                  <Td><Button variant="ghost" size="sm" onClick={() => setOpenId(c.id)}>Open</Button></Td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      </div>
    </AdminPage>
  );
}

function CampaignDetail({ id, cats, onClose, onChanged, onEdit }: { id: string; cats: { slug: string; name: string }[]; onClose: () => void; onChanged: () => void; onEdit: (c: Campaign) => void }) {
  const { data, error, loading, reload } = useLive(() => whatsappLive.campaign(id), [id]);
  const [confirm, setConfirm] = useState<"approve" | "cancel" | null>(null);
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast(ok); await reload(); onChanged(); } catch (e) { toast.error(e instanceof Error ? e.message : "Not done."); await reload(); } finally { setBusy(false); setConfirm(null); }
  };
  if (!data) return <Panel title="Campaign"><LiveState error={error} loading={loading} onRetry={() => void reload()} /></Panel>;
  const c = data.campaign, a = data.audience;
  return (
    <Panel title={c.name} action={<Button variant="ghost" size="sm" onClick={onClose}>Close</Button>}>
      <div className="grid gap-6 md:grid-cols-2 text-sm">
        <div className="space-y-1.5">
          <p><span className="text-muted-foreground">Template:</span> <span className="font-mono">{c.templateName}</span> ({c.language})</p>
          <p><span className="text-muted-foreground">Variables:</span> {c.params.length ? c.params.join(" · ") : "none"}</p>
          <p><span className="text-muted-foreground">Audience:</span> {SEGMENT_TEXT(c.segment, cats)}</p>
          <p><span className="text-muted-foreground">Status:</span> {STATUS_TEXT[c.status]}{c.approvedAt ? ` on ${istDateTime(c.approvedAt)}` : ""}</p>
          {c.scheduledAt && <p><span className="text-muted-foreground">Sends from:</span> {istDateTime(c.scheduledAt)}</p>}
        </div>
        {a ? (
          <div>
            <p className="text-lg font-medium">{a.eligible} customers would receive this</p>
            <p className="text-xs text-muted-foreground">{a.optedIn} agreed to offers · {a.notInSegment} outside this audience · {a.optedOut} opted out · {a.blocked} blocked or invalid number</p>
            {data.sample.length > 0 && <p className="mt-2 text-xs">For example: {data.sample.map((s) => `${s.name} (${s.phone})`).join(", ")}</p>}
            {a.eligible > c.maxRecipients && <p className="mt-2 text-xs text-destructive">More than this campaign's limit of {c.maxRecipients}. Raise the limit or narrow the audience.</p>}
          </div>
        ) : (
          <div className="text-xs">
            <p>Waiting {c.report.queued} · Accepted by Meta {c.report.accepted} · Sent {c.report.sent} · Delivered {c.report.delivered} · Read {c.report.read} · Failed {c.report.failed} · Not sent {c.report.skipped}</p>
            {data.failures.length > 0 && <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">{data.failures.map((f, i) => <li key={i}><span className="font-mono">{f.phone}</span> — {f.errorTitle ?? f.state.toLowerCase()}{f.errorCode ? ` (#${f.errorCode})` : ""}</li>)}</ul>}
          </div>
        )}
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {c.status === "DRAFT" && <Button variant="outline" onClick={() => onEdit(c)}>Edit draft</Button>}
        {(c.status === "DRAFT" || (c.status === "APPROVED" && c.report.queued > 0)) && <Button variant="outline" disabled={busy} onClick={() => setConfirm("cancel")}>Cancel campaign</Button>}
        {c.status === "DRAFT" && a && <Button variant="lux" disabled={busy || a.eligible === 0 || a.eligible > c.maxRecipients} onClick={() => setConfirm("approve")}>Approve and send to {a.eligible}</Button>}
      </div>
      <ConfirmDialog open={confirm === "approve"} onOpenChange={(o) => !o && setConfirm(null)} title={`Send “${c.name}” to ${a?.eligible ?? 0} customers?`}
        description={`This uses Meta's paid marketing messages${c.scheduledAt ? `, starting ${istDateTime(c.scheduledAt)}` : " now"}. Only customers who agreed to WhatsApp offers are included. Only the owner can approve.`}
        confirmLabel="Approve and send" onConfirm={() => void act(() => whatsappLive.approveCampaign(c.id, a?.eligible ?? 0), "Approved — messages are queued")} />
      <ConfirmDialog open={confirm === "cancel"} onOpenChange={(o) => !o && setConfirm(null)} title="Cancel this campaign?" description="Messages not yet sent are stopped. Messages already accepted by Meta can't be recalled."
        confirmLabel="Cancel campaign" onConfirm={() => void act(() => whatsappLive.cancelCampaign(c.id), "Campaign cancelled")} />
    </Panel>
  );
}
