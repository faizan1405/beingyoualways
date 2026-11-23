import { useState } from "react";
import { toast } from "sonner";

import { Panel } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { whatsappLive } from "@/services/whatsappLiveService";
import { istDateTime, useLive } from "./shared";
import { MessageStatePill } from "./whatsappShared";

/** WhatsApp updates for one order, with Meta's delivery ticks; failed ones can be tried again. */
export function OrderWhatsAppPanel({ orderId, version }: { orderId: string; version: string }) {
  const { data, error, reload } = useLive(() => whatsappLive.orderMessages(orderId), [orderId, version]);
  const [busy, setBusy] = useState<string | null>(null);
  const retry = async (purpose: string) => {
    setBusy(purpose);
    try { await whatsappLive.retryOrderMessage(orderId, purpose); toast("Queued to send again"); await reload(); } catch (e) { toast.error(e instanceof Error ? e.message : "Not queued."); } finally { setBusy(null); }
  };
  return (
    <Panel title="WhatsApp updates">
      {error ? <p className="text-sm text-destructive">{error}</p> : !data ? <p className="text-sm text-muted-foreground">Loading…</p> : data.length === 0 ? <p className="text-sm text-muted-foreground">No WhatsApp updates for this order.</p> : (
        <ul className="space-y-2.5 text-sm">
          {data.map((m) => (
            <li key={m.id} className="border-l-2 border-border pl-3">
              <p className="flex flex-wrap items-center gap-2"><span>{m.label ?? m.purpose}</span><MessageStatePill state={m.state} /></p>
              <p className="text-xs text-muted-foreground">{istDateTime(m.at)}{m.deliveredAt ? ` · delivered ${istDateTime(m.deliveredAt)}` : ""}{m.readAt ? ` · read ${istDateTime(m.readAt)}` : ""}</p>
              {m.error && <p className="text-xs text-destructive">{m.errorCode ? `#${m.errorCode} ` : ""}{m.error}</p>}
              {m.state === "FAILED" && m.purpose && <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => void retry(m.purpose!)}>{busy === m.purpose ? "Queuing…" : "Try again"}</Button>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
