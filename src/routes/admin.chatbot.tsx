import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminPage, NotConnected, Panel, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { ChatbotMenuItem } from "@/lib/types";
import { whatsappService } from "@/services/whatsappService";

export const Route = createFileRoute("/admin/chatbot")({ component: Chatbot });

function Chatbot() {
  const { data } = useQuery({ queryKey: ["admin", "chatbot"], queryFn: whatsappService.chatbotMenu });
  const [menu, setMenu] = useState<ChatbotMenuItem[]>([]);
  const [handoff, setHandoff] = useState(true);
  const [hours, setHours] = useState("Mon–Sat, 10am–6pm");
  useEffect(() => { if (data) setMenu(data); }, [data]);
  const up = (i: number, patch: Partial<ChatbotMenuItem>) => setMenu(menu.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  return (
    <AdminPage title="WhatsApp Chatbot" actions={<NotConnected />} subtitle="Rules-based menu replies (not AI). Configuration preview only.">
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Panel title="Menu, FAQ & order-tracking replies" action={<Button size="sm" variant="outline" onClick={() => setMenu([...menu, { id: `b${Date.now()}`, keyword: String(menu.length + 1), label: "", response: "" }])}><Plus /> Add option</Button>}>
          <div className="space-y-3">
            {menu.map((m, i) => (
              <div key={m.id} className="grid gap-3 rounded-md bg-secondary/60 p-3 sm:grid-cols-[70px_1fr_auto]">
                <div><label className={adminLabel} htmlFor={`k${i}`}>Key</label><input id={`k${i}`} className={adminInput} value={m.keyword} onChange={(e) => up(i, { keyword: e.target.value })} /></div>
                <div className="space-y-2">
                  <div><label className={adminLabel} htmlFor={`l${i}`}>Menu label</label><input id={`l${i}`} className={adminInput} value={m.label} onChange={(e) => up(i, { label: e.target.value })} /></div>
                  <div><label className={adminLabel} htmlFor={`r${i}`}>Reply (may include product links)</label><textarea id={`r${i}`} rows={2} className={`${adminInput} h-auto py-2`} value={m.response} onChange={(e) => up(i, { response: e.target.value })} /></div>
                </div>
                <Button variant="ghost" size="icon" aria-label="Remove option" onClick={() => setMenu(menu.filter((_, j) => j !== i))}><Trash2 /></Button>
              </div>
            ))}
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel title="Human support handoff">
            <label className="flex items-center justify-between text-sm">Allow handoff to team <Switch checked={handoff} onCheckedChange={setHandoff} /></label>
            <label htmlFor="sh" className={`${adminLabel} mt-4`}>Support hours</label>
            <input id="sh" className={adminInput} value={hours} onChange={(e) => setHours(e.target.value)} />
          </Panel>
          <Panel title="Preview">
            <div className="space-y-2 rounded-xl bg-sage/25 p-4 text-sm">
              <div className="max-w-[90%] rounded-lg bg-card p-3 shadow-soft">Hi! Welcome to Being You – Always 🌿 Reply with a number:<br />{menu.map((m) => <span key={m.id} className="block">{m.keyword}. {m.label}</span>)}</div>
            </div>
          </Panel>
          <Button variant="lux" size="xl" className="w-full" onClick={() => toast("Chatbot settings saved (demo)")}>Save chatbot</Button>
        </div>
      </div>
    </AdminPage>
  );
}
