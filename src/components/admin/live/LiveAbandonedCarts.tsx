import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AdminPage, Panel, Table, Td, adminInput } from "@/components/admin/AdminUI";
import { inrPaise } from "@/lib/format";
import { whatsappLive, type CartRow } from "@/services/whatsappLiveService";
import { LiveState, istDateTime, useLive } from "./shared";
import { MessageStatePill } from "./whatsappShared";

const STATUS_TEXT: Record<CartRow["status"], string> = { OPEN: "Waiting (reminder scheduled)", REMINDED: "Reminder sent", CONVERTED: "Ordered", SKIPPED: "No reminder", EXPIRED: "Expired" };

/** Checkouts that were started but not finished, with the single 6-hour WhatsApp reminder. */
export function LiveAbandonedCarts() {
  const [status, setStatus] = useState("");
  const { data, error, loading, reload } = useLive(() => whatsappLive.carts(status || undefined), [status]);
  const auto = useLive(() => whatsappLive.automations(), []);
  const toggle = async (on: boolean) => {
    if (!auto.data) return;
    try { auto.setData(await whatsappLive.saveAutomations({ ...auto.data, abandonedCart: on })); toast(on ? "Bag reminders switched on" : "Bag reminders switched off"); } catch (e) { toast.error(e instanceof Error ? e.message : "Not saved."); }
  };
  const c = data?.counts ?? {};
  const recovered = c["CONVERTED"] ?? 0, reminded = (c["REMINDED"] ?? 0) + recovered;
  return (
    <AdminPage title="Bag reminders" subtitle="When a shopper starts checkout, ticks “remind me on WhatsApp”, and doesn't finish, one reminder is sent 6 hours after their last activity.">
      <div className="space-y-6">
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!auto.data?.abandonedCart} disabled={!auto.data} onChange={(e) => void toggle(e.target.checked)} /> Send the 6-hour reminder</label>
            <p>Waiting {c["OPEN"] ?? 0} · Reminded {c["REMINDED"] ?? 0} · Ordered {recovered} · No reminder {c["SKIPPED"] ?? 0}{reminded ? ` · ${Math.round((recovered / Math.max(1, (c["REMINDED"] ?? 0) + recovered)) * 100)}% finished checkout` : ""}</p>
            <p className="text-xs text-muted-foreground">Uses the “Bag reminder” template — set it up on <Link to="/admin/whatsapp-api" className="underline">WhatsApp API</Link>.</p>
          </div>
        </Panel>
        <Panel title="Checkouts" action={<select aria-label="Filter" className={`${adminInput} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{Object.entries(STATUS_TEXT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}>
          {!data ? <LiveState error={error} loading={loading} onRetry={() => void reload()} /> : data.carts.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No unfinished checkouts recorded.</p> : (
            <Table head={["Shopper", "Bag", "Last activity", "Status", "WhatsApp"]}>
              {data.carts.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <Td><span className="font-medium">{r.name}</span><span className="block font-mono text-xs">{r.phone}</span></Td>
                  <Td>{r.items} item{r.items === 1 ? "" : "s"} · {inrPaise(r.subtotalPaise)}</Td>
                  <Td className="text-xs">{istDateTime(r.lastActivityAt)}{r.status === "OPEN" && <span className="block text-muted-foreground">Reminder at {istDateTime(r.remindAt)}</span>}</Td>
                  <Td className="text-xs">{STATUS_TEXT[r.status]}{r.orderId && <Link to="/admin/orders/$id" params={{ id: r.orderId }} className="block underline">View order</Link>}{r.note && <span className="block text-muted-foreground">{r.note}</span>}</Td>
                  <Td>{r.message ? <><MessageStatePill state={r.message.state} />{r.message.error && <span className="block text-xs text-destructive">{r.message.error}</span>}</> : <span className="text-xs text-muted-foreground">—</span>}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      </div>
    </AdminPage>
  );
}
