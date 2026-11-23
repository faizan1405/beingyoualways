import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminPage, NotConnected, Panel, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button, chipVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useDemoStore } from "@/hooks/use-demo-store";
import { newId } from "@/lib/demo-store";
import type { ChatbotConfig, ChatbotMenu, ChatbotOption } from "@/lib/types";
import { cn } from "@/lib/utils";
import { replyToText } from "@/lib/whatsapp-cloud";
import { chatbotStore, fillTemplate, whatsappService } from "@/services/whatsappService";
import { LiveChatbot } from "@/components/admin/live/LiveChatbot";
import { isBackendConfigured } from "@/services/api";

export const Route = createFileRoute("/admin/chatbot")({ component: () => (isBackendConfigured() ? <LiveChatbot /> : <Chatbot />) });

type Bubble = { from: "bot" | "user"; text: string; options?: ChatbotOption[] | undefined };
const STORE = { store_url: "beingyoualways.com" };

/** Walks the menus the way a customer would (frontend preview only). */
function Conversation({ config }: { config: ChatbotConfig }) {
  const menuOf = (id?: string) => config.menus.find((m) => m.id === id && m.enabled);
  const open = (m: ChatbotMenu): Bubble => ({ from: "bot", text: m.greeting, options: m.options });
  const start = () => { const m = menuOf(config.entryMenuId); return m ? [open(m)] : [{ from: "bot" as const, text: "The first menu is switched off — customers would get no reply." }]; };
  const [chat, setChat] = useState<Bubble[]>(start);
  useEffect(() => { setChat(start()); }, [config]); // eslint-disable-line react-hooks/exhaustive-deps
  const [typed, setTyped] = useState("");
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const t = typed.trim();
    if (!t) return;
    const r = replyToText(t, config, STORE.store_url);
    setChat((c) => [...c.map((b) => ({ ...b, options: undefined })), { from: "user", text: t }, { from: "bot", text: r.reply + (r.handoff ? "\n\n(Handed to a team member)" : "") }]);
    setTyped("");
  };
  const choose = (o: ChatbotOption) => {
    const next = menuOf(o.next);
    setChat((c) => [...c.map((b) => ({ ...b, options: undefined })), { from: "user", text: o.label }, { from: "bot", text: fillTemplate(o.response, STORE) }, ...(next ? [open(next)] : [])]);
  };
  return (
    <div>
      <div className="max-h-[440px] space-y-2 overflow-y-auto rounded-xl bg-sage/25 p-4 text-sm" aria-live="polite">
        {chat.map((b, i) => (
          <div key={i} className={b.from === "user" ? "ml-auto max-w-[80%] rounded-lg rounded-tr-none bg-primary p-3 text-primary-foreground" : "max-w-[90%] rounded-lg rounded-tl-none bg-card p-3 shadow-soft"}>
            <p className="whitespace-pre-line">{b.text}</p>
            {b.options && b.options.length > 0 && (
              <div className="mt-2 flex flex-col gap-1.5">{b.options.map((o) => <button key={o.id} type="button" onClick={() => choose(o)} className="rounded-md border border-primary/30 px-3 py-1.5 text-left text-xs font-medium text-primary hover:bg-primary/5">{o.label || "(no label)"}</button>)}</div>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={send} className="mt-2 flex gap-2">
        <label htmlFor="typed" className="sr-only">Type a message like a customer</label>
        <input id="typed" className={adminInput} placeholder="Type like a customer, e.g. where is my order BYA-1042" value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={300} />
        <Button type="submit" size="sm" variant="outline" className="h-10">Send</Button>
      </form>
      <p className="mt-1 text-[11px] text-muted-foreground">Typed messages are matched to product, order tracking, shipping, refund and support topics; anything unclear goes to a person.</p>
      <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => setChat(start())}><RotateCcw /> Restart preview</Button>
    </div>
  );
}

function Chatbot() {
  const saved = useDemoStore(chatbotStore);
  const [c, setC] = useState<ChatbotConfig>(saved);
  useEffect(() => { setC(saved); }, [saved]);
  const [sel, setSel] = useState(saved.entryMenuId);
  const [del, setDel] = useState<ChatbotMenu | null>(null);
  const menu = c.menus.find((m) => m.id === sel) ?? c.menus[0];
  const dirty = JSON.stringify(c) !== JSON.stringify(saved);

  const upMenu = (patch: Partial<ChatbotMenu>) => menu && setC({ ...c, menus: c.menus.map((m) => (m.id === menu.id ? { ...m, ...patch } : m)) });
  const upOpt = (i: number, patch: Partial<ChatbotOption>) => menu && upMenu({ options: menu.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const move = (i: number, d: -1 | 1) => { if (!menu) return; const o = [...menu.options]; const [x] = o.splice(i, 1); o.splice(i + d, 0, x!); upMenu({ options: o }); };
  const addMenu = () => { const m: ChatbotMenu = { id: newId("m"), name: "New menu", enabled: true, greeting: "How can we help?", options: [] }; setC({ ...c, menus: [...c.menus, m] }); setSel(m.id); };

  return (
    <AdminPage title="WhatsApp Chatbot" actions={<NotConnected />} subtitle="Rules-based replies (not AI). On the live server, customer messages arrive through Meta's webhook and get these replies. Build and try the flow here — it isn't connected to WhatsApp yet.">
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Panel title="Menus" action={<Button size="sm" variant="outline" onClick={addMenu}><Plus /> New menu</Button>}>
            <div className="flex flex-wrap gap-2">
              {c.menus.map((m) => (
                <button key={m.id} type="button" aria-pressed={m.id === menu?.id} onClick={() => setSel(m.id)} className={cn(chipVariants({ active: m.id === menu?.id }), !m.enabled && "opacity-60")}>
                  {m.name}{m.id === c.entryMenuId ? " · first" : ""}{!m.enabled ? " · off" : ""}
                </button>
              ))}
            </div>
          </Panel>
          {menu && (
            <Panel title={`Edit: ${menu.name}`} action={<Button size="sm" variant="ghost" disabled={menu.id === c.entryMenuId} onClick={() => setDel(menu)} aria-label="Delete menu"><Trash2 className="text-destructive" /> Delete menu</Button>}>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                <div><label htmlFor="mn" className={adminLabel}>Menu name</label><input id="mn" className={adminInput} value={menu.name} onChange={(e) => upMenu({ name: e.target.value })} /></div>
                <label className="flex h-10 items-center gap-2 text-sm">Flow enabled <Switch checked={menu.enabled} onCheckedChange={(v) => upMenu({ enabled: v })} aria-label="Flow enabled" /></label>
                <label className="flex h-10 items-center gap-2 text-sm"><input type="radio" name="entry" checked={c.entryMenuId === menu.id} onChange={() => setC({ ...c, entryMenuId: menu.id })} /> First menu</label>
              </div>
              <div className="mt-3"><label htmlFor="mg" className={adminLabel}>Opening message</label><textarea id="mg" rows={2} className={`${adminInput} h-auto py-2`} value={menu.greeting} onChange={(e) => upMenu({ greeting: e.target.value })} /></div>
              <div className="mt-4 space-y-3">
                {menu.options.map((o, i) => (
                  <div key={o.id} className="grid gap-3 rounded-md bg-secondary/60 p-3 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div><label className={adminLabel} htmlFor={`l${o.id}`}>Button {i + 1}</label><input id={`l${o.id}`} maxLength={24} className={adminInput} value={o.label} onChange={(e) => upOpt(i, { label: e.target.value })} /></div>
                        <div><label className={adminLabel} htmlFor={`n${o.id}`}>Then open</label>
                          <select id={`n${o.id}`} className={adminInput} value={o.next ?? ""} onChange={(e) => upOpt(i, { next: e.target.value || undefined })}><option value="">Nothing (end)</option>{c.menus.filter((m) => m.id !== menu.id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
                      </div>
                      <div><label className={adminLabel} htmlFor={`r${o.id}`}>Reply</label><textarea id={`r${o.id}`} rows={2} className={`${adminInput} h-auto py-2`} value={o.response} onChange={(e) => upOpt(i, { response: e.target.value })} /></div>
                    </div>
                    <div className="flex gap-1 sm:flex-col">
                      <Button type="button" variant="ghost" size="icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                      <Button type="button" variant="ghost" size="icon" aria-label="Move down" disabled={i === menu.options.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                      <Button type="button" variant="ghost" size="icon" aria-label="Remove button" onClick={() => upMenu({ options: menu.options.filter((_, j) => j !== i) })}><Trash2 /></Button>
                    </div>
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" disabled={menu.options.length >= 10} onClick={() => upMenu({ options: [...menu.options, { id: newId("o"), label: "", response: "" }] })}><Plus /> Add button</Button>
                <p className="text-[11px] text-muted-foreground">Up to 10 buttons, 24 characters each (WhatsApp list limits). Use {"{store_url}"} to link to the shop.</p>
              </div>
            </Panel>
          )}
        </div>
        <div className="space-y-4">
          <Panel title="Customer conversation preview"><Conversation config={c} /></Panel>
          <Panel title="Human support handoff">
            <label className="flex items-center justify-between text-sm">Allow handoff to team <Switch checked={c.handoff} onCheckedChange={(v) => setC({ ...c, handoff: v })} aria-label="Allow handoff to team" /></label>
            <label htmlFor="sh" className={`${adminLabel} mt-4`}>Support hours</label>
            <input id="sh" className={adminInput} value={c.supportHours} onChange={(e) => setC({ ...c, supportHours: e.target.value })} />
          </Panel>
          <Button variant="lux" size="xl" className="w-full" disabled={!dirty} onClick={() => { try { whatsappService.saveChatbot(c); toast("Chatbot saved (preview only — not connected to WhatsApp)"); } catch (e) { toast.error((e as Error).message); } }}>Save chatbot</Button>
          {dirty && <Button variant="ghost" className="w-full" onClick={() => setC(saved)}>Discard changes</Button>}
        </div>
      </div>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Delete “${del?.name ?? ""}”?`} confirmLabel="Delete menu" description="Buttons that open this menu will end the conversation instead. Press Save chatbot to keep the change."
        onConfirm={() => { if (!del) return; setC({ ...c, menus: c.menus.filter((m) => m.id !== del.id).map((m) => ({ ...m, options: m.options.map((o) => (o.next === del.id ? { ...o, next: undefined } : o)) })) }); setSel(c.entryMenuId); }} />
    </AdminPage>
  );
}
