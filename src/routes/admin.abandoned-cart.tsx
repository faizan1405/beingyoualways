import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminPage, NotConnected, Panel, Table, Td, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { inr } from "@/lib/format";
import type { AbandonedCartSettings } from "@/lib/types";
import { whatsappService } from "@/services/whatsappService";

export const Route = createFileRoute("/admin/abandoned-cart")({ component: Abandoned });

function Abandoned() {
  const { data: carts = [] } = useQuery({ queryKey: ["admin", "abandoned"], queryFn: whatsappService.abandonedCarts });
  const { data } = useQuery({ queryKey: ["admin", "abandoned-settings"], queryFn: whatsappService.abandonedSettings });
  const [s, setS] = useState<AbandonedCartSettings | null>(null);
  useEffect(() => { if (data) setS(data); }, [data]);
  if (!s) return <div className="h-96 animate-pulse rounded-xl bg-card" />;

  const preview = s.template.replace("{name}", "Riya").replace("{cart_link}", "beingyou.example/cart") + (s.includeDiscount && s.discountCode ? ` Use code ${s.discountCode} at checkout.` : "");

  return (
    <AdminPage title="Abandoned Cart Automation" actions={<NotConnected />} subtitle={`Reminder sent ${s.delayHours} hours after a cart is abandoned. Nothing is scheduled or sent in this prototype.`}>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Reminder settings">
          <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); await whatsappService.saveAbandonedSettings(s); toast("Settings saved (demo) — no reminders will be sent"); }}>
            <label className="flex items-center justify-between text-sm">Enable 6-hour reminder <Switch checked={s.enabled} onCheckedChange={(v) => setS({ ...s, enabled: v })} /></label>
            <div><label htmlFor="dh" className={adminLabel}>Delay (hours)</label><input id="dh" type="number" min={1} className={adminInput} value={s.delayHours} onChange={(e) => setS({ ...s, delayHours: Number(e.target.value) })} /><p className="mt-1 text-xs text-muted-foreground">Agreed value: 6 hours.</p></div>
            <div><label htmlFor="tm" className={adminLabel}>Message template</label><textarea id="tm" rows={4} className={`${adminInput} h-auto py-2`} value={s.template} onChange={(e) => setS({ ...s, template: e.target.value })} /><p className="mt-1 text-xs text-muted-foreground">Variables: {"{name}"}, {"{cart_link}"}</p></div>
            <label className="flex items-center justify-between text-sm">Include discount code <Switch checked={s.includeDiscount} onCheckedChange={(v) => setS({ ...s, includeDiscount: v })} /></label>
            {s.includeDiscount && <div><label htmlFor="dc" className={adminLabel}>Discount code</label><input id="dc" className={adminInput} value={s.discountCode} onChange={(e) => setS({ ...s, discountCode: e.target.value })} /></div>}
            <Button variant="lux" size="xl" type="submit">Save settings</Button>
          </form>
        </Panel>
        <Panel title="WhatsApp preview">
          <div className="rounded-xl bg-sage/25 p-6">
            <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-card p-3 text-sm shadow-soft">{preview}<p className="mt-1 text-right text-[10px] text-muted-foreground">Preview · not sent</p></div>
          </div>
        </Panel>
      </div>
      <Panel title="Abandoned carts (sample)">
        <Table head={["Customer", "Phone", "Items", "Value", "Reminder due"]}>
          {carts.map((c) => <tr key={c.id}><Td className="font-semibold">{c.customerName}</Td><Td>{c.phone}</Td><Td>{c.items}</Td><Td>{inr(c.value)}</Td><Td>{s.enabled ? c.reminderDueAt.replace("T", " ").replace("Z", " UTC") : "Disabled"}</Td></tr>)}
        </Table>
      </Panel>
    </AdminPage>
  );
}
