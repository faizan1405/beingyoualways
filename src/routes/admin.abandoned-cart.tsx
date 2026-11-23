import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminPage, NotConnected, Panel, Table, Td, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { Pill } from "@/components/shop/OrderBadges";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAllProducts, useDemoStore } from "@/hooks/use-demo-store";
import { inr } from "@/lib/format";
import type { AbandonedCartSettings } from "@/lib/types";
import { discountStore } from "@/services/discountService";
import { REMINDER_LABEL, reminderDecision, type ReminderDecision } from "@/lib/whatsapp-cloud";
import { abandonedStore, fillTemplate, reminderDueAt, whatsappService } from "@/services/whatsappService";
import { LiveAbandonedCarts } from "@/components/admin/live/LiveAbandonedCarts";
import { isBackendConfigured } from "@/services/api";

// Carts already reminded come from the server's message log; nothing has been sent, so it is empty.
const REMINDED = new Set<string>();
const TONE: Record<ReminderDecision, "info" | "warn" | "muted"> = { due: "info", waiting: "warn", off: "muted", "checked-out": "muted", "no-consent": "muted", "already-sent": "muted", "invalid-number": "warn" };

export const Route = createFileRoute("/admin/abandoned-cart")({ component: () => (isBackendConfigured() ? <LiveAbandonedCarts /> : <Abandoned />) });

const fmt = (d: Date) => d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

function Abandoned() {
  const saved = useDemoStore(abandonedStore);
  const products = useAllProducts();
  const discounts = useDemoStore(discountStore);
  const carts = whatsappService.abandonedCarts();
  const [s, setS] = useState<AbandonedCartSettings>(saved.settings);
  useEffect(() => { setS(saved.settings); }, [saved.settings]);
  const now = new Date();
  const dirty = JSON.stringify(s) !== JSON.stringify(saved.settings);

  const rows = carts.map((c) => {
    const lines = c.items.map((i) => { const p = products.find((x) => x.id === i.productId); const v = p?.variants.find((x) => x.id === i.variantId); return { name: p?.name ?? "Removed product", label: v?.label ?? "", price: v?.price ?? 0, quantity: i.quantity }; });
    const due = reminderDueAt(c, saved.settings.delayHours);
    return { ...c, lines, value: lines.reduce((t, l) => t + l.price * l.quantity, 0), due, decision: reminderDecision(c, saved.settings, now, REMINDED) };
  });
  const preview = fillTemplate(s.template, { name: "Riya", cart_link: "beingyoualways.com/cart" }) + (s.includeDiscount && s.discountCode ? ` Use code ${s.discountCode} at checkout.` : "");

  return (
    <AdminPage title="Abandoned Cart Automation" actions={<NotConnected />} subtitle={`Reminder planned ${saved.settings.delayHours} hour${saved.settings.delayHours === 1 ? "" : "s"} after a cart is left. Simulation only — no reminders are sent until the backend and an approved WhatsApp API are connected.`}>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Reminder settings">
          <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); try { whatsappService.saveAbandonedSettings({ ...s, discountCode: s.includeDiscount ? s.discountCode : "" }); toast("Settings saved — no reminders will be sent (simulation)"); } catch (err) { toast.error((err as Error).message); } }}>
            <label className="flex items-center justify-between text-sm">Automation enabled <Switch checked={s.enabled} onCheckedChange={(v) => setS({ ...s, enabled: v })} aria-label="Automation enabled" /></label>
            <div><label htmlFor="dh" className={adminLabel}>Send reminder after (hours)</label><input id="dh" type="number" min={1} max={72} className={adminInput} value={s.delayHours} onChange={(e) => setS({ ...s, delayHours: Number(e.target.value) })} /><p className="mt-1 text-xs text-muted-foreground">Agreed with the client: 6 hours. Allowed: 1–72.</p></div>
            <div><label htmlFor="tm" className={adminLabel}>Message template</label><textarea id="tm" rows={4} maxLength={1024} className={`${adminInput} h-auto py-2`} value={s.template} onChange={(e) => setS({ ...s, template: e.target.value })} /><p className="mt-1 text-xs text-muted-foreground">Variables: {"{name}"}, {"{cart_link}"} (required). Must match the wording Meta approves for the <span className="font-mono">abandoned_cart_reminder</span> template.</p></div>
            <label className="flex items-center justify-between text-sm">Include a discount code <Switch checked={s.includeDiscount} onCheckedChange={(v) => setS({ ...s, includeDiscount: v })} aria-label="Include a discount code" /></label>
            {s.includeDiscount && (
              <div><label htmlFor="dc" className={adminLabel}>Discount code</label>
                <select id="dc" className={adminInput} value={s.discountCode} onChange={(e) => setS({ ...s, discountCode: e.target.value })}><option value="">Choose…</option>{discounts.map((d) => <option key={d.id} value={d.code}>{d.code}{d.active ? "" : " (off)"}</option>)}</select>
                {discounts.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Create a code in Admin → Discounts first.</p>}</div>
            )}
            <Button variant="lux" size="xl" type="submit" disabled={!dirty}>Save settings</Button>
          </form>
        </Panel>
        <Panel title="WhatsApp preview">
          <div className="rounded-xl bg-sage/25 p-6">
            <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-card p-3 text-sm shadow-soft">{preview}<p className="mt-1 text-right text-[10px] text-muted-foreground">Preview · not sent</p></div>
          </div>
        </Panel>
      </div>
      <Panel title="Abandoned carts (demo)">
        <Table head={["Shopper", "Products in cart", "Cart value", "Left at", "Reminder timing", "WhatsApp consent", "Reminder"]}>
          {rows.map((c) => (
            <tr key={c.id}>
              <Td className="font-semibold">{c.customerName}<div className="text-xs font-normal text-muted-foreground">{c.phone}</div></Td>
              <Td><ul className="text-xs">{c.lines.map((l) => <li key={l.name + l.label}>{l.name} · {l.label} × {l.quantity}</li>)}</ul></Td>
              <Td>{inr(c.value)}</Td><Td>{fmt(new Date(c.abandonedAt))}</Td>
              <Td>{saved.settings.enabled ? fmt(c.due) : "Automation off"}</Td>
              <Td className="text-xs">{c.whatsappConsent === true ? "Yes" : c.whatsappConsent === false ? "No" : "Not asked"}</Td>
              <Td><Pill t={TONE[c.decision]}>{REMINDER_LABEL[c.decision]}</Pill></Td>
            </tr>
          ))}
        </Table>
        <p className="mt-3 text-[11px] text-muted-foreground">Cart values use today's prices. The Hostinger server runs the same checks every few minutes: reminders go only to shoppers who agreed to WhatsApp messages, once per cart, using the approved <span className="font-mono">abandoned_cart_reminder</span> template, and are cancelled if checkout is completed. “Due” means the server would send now — nothing is sent from this demo. Demo phone numbers are masked, so they can't receive messages.</p>
      </Panel>
      <Panel title="Automation history">
        {saved.history.length === 0 ? <p className="text-sm text-muted-foreground">No changes yet. Each saved change is listed here.</p> : (
          <ol className="space-y-2 text-sm">{saved.history.map((h, i) => <li key={i} className="flex justify-between gap-4"><span>{h.label}</span><span className="shrink-0 text-xs text-muted-foreground">{fmt(new Date(h.at))}</span></li>)}</ol>
        )}
      </Panel>
    </AdminPage>
  );
}
