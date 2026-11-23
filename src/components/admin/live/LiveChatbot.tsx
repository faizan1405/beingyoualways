import { RefreshCw } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AdminPage, Panel, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { whatsappLive, type ChatbotSettings, type InboxThread } from "@/services/whatsappLiveService";
import { LiveState, istDateTime, useLive } from "./shared";
import { MessageStatePill } from "./whatsappShared";

/** WhatsApp chatbot settings and the inbox of conversations it handed to a person. */
export function LiveChatbot() {
  const settings = useLive(() => whatsappLive.chatbot(), []);
  const auto = useLive(() => whatsappLive.automations(), []);
  const inbox = useLive(() => whatsappLive.inbox(), []);
  const [form, setForm] = useState<ChatbotSettings | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (settings.data) setForm(settings.data); }, [settings.data]);
  const save = async (e: FormEvent) => {
    e.preventDefault(); if (!form) return; setBusy(true);
    try { settings.setData(await whatsappLive.saveChatbot(form)); toast("Saved"); } catch (err) { toast.error(err instanceof Error ? err.message : "Not saved."); } finally { setBusy(false); }
  };
  const toggle = async (on: boolean) => {
    if (!auto.data) return;
    try { auto.setData(await whatsappLive.saveAutomations({ ...auto.data, chatbot: on })); toast(on ? "Chatbot on" : "Chatbot off — messages go straight to the inbox"); } catch (e) { toast.error(e instanceof Error ? e.message : "Not saved."); }
  };
  return (
    <AdminPage title="WhatsApp chatbot" subtitle="Replies only from real store records: order status (to the number that placed the order), products and prices, shipping settings and policy pages. Anything else goes to a person.">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Panel title="Settings">
          <label className="mb-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!auto.data?.chatbot} disabled={!auto.data} onChange={(e) => void toggle(e.target.checked)} /> Answer customers automatically</label>
          {!form ? <LiveState error={settings.error} loading={settings.loading} onRetry={() => void settings.reload()} /> : (
            <form className="space-y-3" onSubmit={save}>
              <div><label htmlFor="cb-greet" className={adminLabel}>Greeting</label><textarea id="cb-greet" className={`${adminInput} h-24 py-2`} value={form.greeting} onChange={(e) => setForm({ ...form, greeting: e.target.value })} maxLength={600} required /></div>
              <div><label htmlFor="cb-hand" className={adminLabel}>When handing to the team</label><textarea id="cb-hand" className={`${adminInput} h-20 py-2`} value={form.handoffText} onChange={(e) => setForm({ ...form, handoffText: e.target.value })} maxLength={600} required /></div>
              <div><label htmlFor="cb-hours" className={adminLabel}>Support hours</label><input id="cb-hours" className={adminInput} value={form.supportHours} onChange={(e) => setForm({ ...form, supportHours: e.target.value })} maxLength={120} /></div>
              <p className="text-xs text-muted-foreground">STOP always opts the customer out of offers and is confirmed automatically.</p>
              <Button type="submit" variant="lux" disabled={busy}>Save</Button>
            </form>
          )}
        </Panel>
        <Panel title="Needs a person" action={<Button variant="ghost" size="sm" onClick={() => void inbox.reload()}><RefreshCw className="size-3.5" /> Refresh</Button>}>
          {!inbox.data ? <LiveState error={inbox.error} loading={inbox.loading} onRetry={() => void inbox.reload()} /> : inbox.data.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nothing waiting.</p> : (
            <div className="space-y-5">{inbox.data.map((t) => <Thread key={t.key} t={t} onDone={() => void inbox.reload()} />)}</div>
          )}
        </Panel>
      </div>
    </AdminPage>
  );
}

function Thread({ t, onDone }: { t: InboxThread; onDone: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast(ok); setText(""); onDone(); } catch (e) { toast.error(e instanceof Error ? e.message : "Not sent."); } finally { setBusy(false); }
  };
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="mb-2 font-mono text-xs">{t.phone}</p>
      <ul className="space-y-1.5">
        {t.messages.map((m) => (
          <li key={m.id} className={cn("max-w-[85%] rounded-lg px-3 py-1.5 text-sm", m.direction === "INBOUND" ? "bg-secondary" : "ml-auto bg-primary/8")}>
            <p className="whitespace-pre-wrap">{m.text ?? "(no text)"}</p>
            <p className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">{istDateTime(m.at)}{m.direction === "OUTBOUND" && <MessageStatePill state={m.state} />}</p>
          </li>
        ))}
      </ul>
      {t.canReply ? (
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void act(() => whatsappLive.reply(t.key, text), "Reply sent to Meta"); }}>
          <label className="sr-only" htmlFor={`r-${t.key}`}>Reply</label>
          <input id={`r-${t.key}`} className={`${adminInput} min-w-0 flex-1`} placeholder="Reply on WhatsApp" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
          <Button type="submit" variant="outline" disabled={busy || !text.trim()}>Send</Button>
        </form>
      ) : <p className="mt-3 text-xs text-muted-foreground">More than 24 hours since the customer's last message — WhatsApp only allows approved templates now. Contact them another way.</p>}
      <div className="mt-2 text-right"><Button variant="ghost" size="sm" disabled={busy} onClick={() => void act(() => whatsappLive.resolve(t.key), "Marked as handled")}>Mark handled</Button></div>
    </div>
  );
}
