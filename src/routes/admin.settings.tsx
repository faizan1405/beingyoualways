import { Link, createFileRoute } from "@tanstack/react-router";
import { Download, KeyRound, RotateCcw, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AdminPage, NotConnected, Panel, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ThemePreviewPanel } from "@/components/admin/ThemePreviewPanel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useDemoStore } from "@/hooks/use-demo-store";
import { downloadText } from "@/lib/download";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from "@/lib/pricing";
import { buildBackup, exportableStores, importBackup, resetAllDemoData, sessionOnlyStores } from "@/services/backupService";
import { contentService, contentStore } from "@/services/contentService";
import { INTEGRATIONS, settingsService, settingsStore, type StoreSettings } from "@/services/settingsService";

export const Route = createFileRoute("/admin/settings")({ component: Settings });

const money = (v: string) => (v === "" ? null : Number(v));
const Status = ({ on, label }: { on: boolean; label?: string }) => on
  ? <span className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success"><span className="size-2 rounded-full bg-success" />{label ?? "Connected"}</span>
  : <NotConnected label={label ?? "Not connected"} />;

function Settings() {
  const saved = useDemoStore(settingsStore);
  const content = useDemoStore(contentStore);
  const [s, setS] = useState<StoreSettings>(saved);
  const [email, setEmail] = useState(content.contact.email);
  const [phones, setPhones] = useState(content.contact.phones.map((p) => p.display).join("\n"));
  const [address, setAddress] = useState(content.contact.addressLines.join("\n"));
  useEffect(() => { setS(saved); }, [saved]);
  useEffect(() => { setEmail(content.contact.email); setPhones(content.contact.phones.map((p) => p.display).join("\n")); setAddress(content.contact.addressLines.join("\n")); }, [content.contact]);
  const [resetting, setResetting] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const save = () => {
    try {
      const lines = phones.split("\n").map((x) => x.trim()).filter(Boolean);
      contentService.save({ ...content, contact: { email: email.trim(), addressLines: address.split("\n"), phones: lines.map((display, i) => ({ label: content.contact.phones[i]?.label ?? (i === 0 ? "Primary" : "Other"), display, tel: "" })) } });
      settingsService.save(s);
      toast.success("Settings saved in this browser (demo). Checkout keeps shipping and COD as pending until the backend is live.");
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <AdminPage title="Store settings" subtitle="Saved in this browser (demo). Never enter API keys, passwords or payment secrets here — they belong on the Hostinger server.">
      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Panel title="General">
          <div className="space-y-3">
            <div><label htmlFor="sn" className={adminLabel}>Store name</label><input id="sn" className={adminInput} value={s.storeName} onChange={(e) => setS({ ...s, storeName: e.target.value })} /></div>
            <div><label htmlFor="se" className={adminLabel}>Store email</label><input id="se" type="email" className={adminInput} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><label htmlFor="sp" className={adminLabel}>Contact numbers (one per line)</label><textarea id="sp" rows={2} className={`${adminInput} h-auto py-2`} value={phones} onChange={(e) => setPhones(e.target.value)} /></div>
            <div><label htmlFor="sa" className={adminLabel}>Business address</label><textarea id="sa" rows={3} className={`${adminInput} h-auto py-2`} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
            <p className="text-[11px] text-muted-foreground">Same details as <Link to="/admin/content" className="underline">Website content</Link> → Contact information.</p>
          </div>
        </Panel>
        <Panel title="Shipping">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="sf" className={adminLabel}>Shipping charge (₹)</label><input id="sf" type="number" min={0} className={adminInput} placeholder="Pending" value={s.shipping.fee ?? ""} onChange={(e) => setS({ ...s, shipping: { ...s.shipping, fee: money(e.target.value) } })} /></div>
            <div><label htmlFor="ft" className={adminLabel}>Free shipping above (₹)</label><input id="ft" type="number" min={0} className={adminInput} placeholder="Pending" value={s.shipping.freeAbove ?? ""} onChange={(e) => setS({ ...s, shipping: { ...s.shipping, freeAbove: money(e.target.value) } })} /></div>
            <div className="sm:col-span-2"><label htmlFor="dn" className={adminLabel}>Delivery settings / timelines</label><input id="dn" className={adminInput} placeholder="e.g. Dispatch in 2–4 working days (once confirmed)" value={s.shipping.deliveryNote} onChange={(e) => setS({ ...s, shipping: { ...s.shipping, deliveryNote: e.target.value } })} /></div>
          </div>
          <label className="mt-3 flex items-center justify-between gap-3 text-sm">Client confirmed these rates in writing <Switch checked={s.shipping.clientConfirmed} onCheckedChange={(v) => setS({ ...s, shipping: { ...s.shipping, clientConfirmed: v } })} aria-label="Client confirmed shipping rates" /></label>
          <p className="mt-2 text-[11px] text-muted-foreground">Status: {s.shipping.fee == null ? "Pending — shoppers see “Pending confirmation”." : s.shipping.clientConfirmed ? "Entered and confirmed — goes live at checkout once the backend is connected." : "Entered, awaiting client confirmation."} Internal sample only: ₹{SHIPPING_FEE} / free above ₹{FREE_SHIPPING_THRESHOLD} (never shown to shoppers).</p>
        </Panel>
        <Panel title="Payments">
          <ul className="space-y-3 text-sm">
            <li className="flex items-center justify-between gap-3">Razorpay configuration <Status on={false} /></li>
            <li className="flex items-center justify-between gap-3">Payment integration <Status on={false} label="Not live — no payment is taken" /></li>
          </ul>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="cod" className={adminLabel}>Cash on Delivery</label><select id="cod" className={adminInput} value={s.payments.cod} onChange={(e) => setS({ ...s, payments: { ...s.payments, cod: e.target.value as StoreSettings["payments"]["cod"] } })}><option value="pending">Pending decision</option><option value="offered">Offered</option><option value="not-offered">Not offered</option></select></div>
            <div><label htmlFor="cc" className={adminLabel}>COD charge (₹)</label><input id="cc" type="number" min={0} className={adminInput} placeholder="Pending" value={s.payments.codCharge ?? ""} onChange={(e) => setS({ ...s, payments: { ...s.payments, codCharge: money(e.target.value) } })} /></div>
            <div className="sm:col-span-2"><label htmlFor="cr" className={adminLabel}>COD limits (order value / PIN codes)</label><input id="cr" className={adminInput} placeholder="Pending" value={s.payments.codNote} onChange={(e) => setS({ ...s, payments: { ...s.payments, codNote: e.target.value } })} /></div>
          </div>
          <label className="mt-3 flex items-center justify-between gap-3 text-sm">Client confirmed COD rules in writing <Switch checked={s.payments.clientConfirmed} onCheckedChange={(v) => setS({ ...s, payments: { ...s.payments, clientConfirmed: v } })} aria-label="Client confirmed COD rules" /></label>
        </Panel>
        <Panel title="Accounts & WhatsApp">
          <ul className="space-y-3 text-sm">
            <li className="flex items-center justify-between gap-3">Google login <Status on={false} /></li>
            <li className="flex items-center justify-between gap-3">WhatsApp OTP login <Status on={false} /></li>
          </ul>
          <label htmlFor="wn" className={`${adminLabel} mt-4`}>WhatsApp Business number (as told by the client)</label>
          <input id="wn" className={adminInput} placeholder="Awaiting client confirmation" value={s.whatsappNumber} onChange={(e) => setS({ ...s, whatsappNumber: e.target.value })} />
          <p className="mt-1 text-[11px] text-muted-foreground">Stored for the checklist only — WhatsApp buttons on the shop stay off until the number is verified with the API.</p>
        </Panel>
        <Panel title="Integrations" className="lg:col-span-2">
          <ul className="divide-y divide-border text-sm">
            {INTEGRATIONS.map((i) => <li key={i.key} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{i.label}</p><p className="text-xs text-muted-foreground">{i.note}</p></div><Status on={i.connected} label={i.connected ? "Working" : "Not connected"} /></li>)}
          </ul>
          <p className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground"><KeyRound className="size-3.5" /> There are intentionally no fields for API keys or secrets — they are configured on the Hostinger server only.</p>
        </Panel>
      </div>
      <Button variant="lux" size="xl" onClick={save}>Save settings</Button>

      <ThemePreviewPanel />

      <Panel title="Demo data & backup">
        <p className="text-sm text-muted-foreground">Admin changes are saved in this browser so they survive a refresh. Export a backup before clearing browser data or switching devices.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-md bg-secondary/60 p-3 text-xs">
            <p className="font-semibold text-foreground">Saved on this browser (included in backups)</p>
            <ul className="mt-1 list-disc pl-4 text-muted-foreground"><li>Products & photos</li>{exportableStores().map((x) => <li key={x.key}>{x.label}</li>)}</ul>
          </div>
          <div className="rounded-md bg-secondary/60 p-3 text-xs">
            <p className="font-semibold text-foreground">This tab only (not exported — may hold personal details)</p>
            <ul className="mt-1 list-disc pl-4 text-muted-foreground">{sessionOnlyStores().map((x) => <li key={x.key}>{x.label}</li>)}<li>Temporary video files chosen for preview</li></ul>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="luxOutline" size="xl" onClick={() => { downloadText(`being-you-demo-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(buildBackup(), null, 2), "application/json"); toast("Backup downloaded"); }}><Download /> Export backup</Button>
          <Button variant="luxOutline" size="xl" onClick={() => file.current?.click()}><Upload /> Import backup</Button>
          <input ref={file} type="file" accept="application/json,.json" className="sr-only" aria-label="Choose a backup file" onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f) return;
            if (f.size > 20 * 1024 * 1024) { toast.error("That file is too large to be a demo backup."); return; }
            const r = await importBackup(await f.text());
            if (!r.ok) { toast.error(r.error); return; }
            toast.success(`Restored: ${r.restored.join(", ") || "nothing"}${r.skipped.length ? ` · Skipped (invalid): ${r.skipped.join(", ")}` : ""}`);
          }} />
          <Button variant="ghost" size="xl" className="text-destructive" onClick={() => setResetting(true)}><RotateCcw /> Reset all demo data</Button>
        </div>
      </Panel>
      <ConfirmDialog open={resetting} onOpenChange={setResetting} title="Reset all demo data?" confirmLabel="Reset everything"
        description="Products, photos, content, settings, campaigns, chatbot, discounts, orders, customers and stories go back to the original demo state in this browser. Export a backup first if you want to keep your changes."
        onConfirm={() => resetAllDemoData().then(() => toast("All demo data reset"))} />
    </AdminPage>
  );
}
