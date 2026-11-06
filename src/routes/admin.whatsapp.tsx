import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AdminPage, NotConnected, Panel, Table, Td, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { Pill } from "@/components/shop/OrderBadges";
import { Button } from "@/components/ui/button";
import type { WhatsAppCampaign } from "@/lib/types";
import { whatsappService } from "@/services/whatsappService";

export const Route = createFileRoute("/admin/whatsapp")({ component: WhatsApp });

const segCounts: Record<string, number> = { all: 1240, new: 310, repeat: 520, vip: 86, inactive: 312 };

function WhatsApp() {
  const qc = useQueryClient();
  const { data: campaigns = [] } = useQuery({ queryKey: ["admin", "campaigns"], queryFn: whatsappService.campaigns });
  const { data: messages = [] } = useQuery({ queryKey: ["admin", "messages"], queryFn: whatsappService.messages });
  const [form, setForm] = useState({ name: "", template: whatsappService.templates[0], segment: "all" as WhatsAppCampaign["segment"], scheduledFor: "" });
  const save = useMutation({
    mutationFn: whatsappService.saveCampaign,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "campaigns"] }); toast("Campaign saved as draft — nothing will be sent (API not connected)"); setForm({ ...form, name: "", scheduledFor: "" }); },
  });

  return (
    <AdminPage title="WhatsApp Marketing" actions={<NotConnected />} subtitle="Interfaces only. No messages are sent from this prototype.">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {["Sent", "Delivered", "Read", "Failed"].map((k) => <Panel key={k}><p className="eyebrow">{k}</p><p className="mt-2 font-serif text-3xl">—</p><p className="text-[10px] uppercase text-muted-foreground">Awaiting API</p></Panel>)}
      </div>
      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <Panel title="Create campaign">
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            if (!form.name.trim()) return toast.error("Campaign name is required");
            save.mutate({ id: `w${Date.now()}`, name: form.name, template: form.template, segment: form.segment, scheduledFor: form.scheduledFor || undefined, status: form.scheduledFor ? "scheduled" : "draft", recipients: segCounts[form.segment] });
          }}>
            <div><label htmlFor="cn" className={adminLabel}>Campaign name</label><input id="cn" className={adminInput} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label htmlFor="ct" className={adminLabel}>Template</label><select id="ct" className={adminInput} value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })}>{whatsappService.templates.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div><label htmlFor="cs" className={adminLabel}>Customer segment</label><select id="cs" className={adminInput} value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value as "all" })}>{Object.keys(segCounts).map((s) => <option key={s} value={s}>{s} (~{segCounts[s]} sample)</option>)}</select></div>
            <div><label htmlFor="cw" className={adminLabel}>Schedule (optional)</label><input id="cw" type="datetime-local" className={adminInput} value={form.scheduledFor} onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} /></div>
            <Button variant="lux" size="xl" className="w-full" type="submit">Save campaign</Button>
          </form>
        </Panel>
        <div className="space-y-4">
          <Panel title="Campaigns">
            <Table head={["Name", "Template", "Segment", "Recipients", "Status"]}>
              {campaigns.map((c) => <tr key={c.id}><Td className="font-semibold">{c.name}</Td><Td>{c.template}</Td><Td className="capitalize">{c.segment}</Td><Td>{c.recipients}</Td><Td><Pill t={c.status === "sent" ? "good" : c.status === "scheduled" ? "info" : "muted"}>{c.status}</Pill></Td></tr>)}
            </Table>
          </Panel>
          <Panel title="Message history (sample)">
            <Table head={["To", "Template", "Sent", "Status"]}>
              {messages.map((m) => <tr key={m.id}><Td>{m.to}</Td><Td>{m.template}</Td><Td>{m.sentAt.slice(0, 10)}</Td><Td><Pill t={m.status === "failed" ? "bad" : m.status === "read" ? "good" : "info"}>{m.status}</Pill></Td></tr>)}
            </Table>
          </Panel>
        </div>
      </div>
    </AdminPage>
  );
}
