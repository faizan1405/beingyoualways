import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminPage, NotConnected, Panel, Table, Td, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Pill } from "@/components/shop/OrderBadges";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useDemoStore } from "@/hooks/use-demo-store";
import { evaluateDiscount, validateDiscount } from "@/lib/discounts";
import { inr } from "@/lib/format";
import type { Discount } from "@/lib/types";
import { blankDiscount, discountService, discountStore } from "@/services/discountService";
import { LiveDiscounts } from "@/components/admin/live/LiveDiscounts";
import { isBackendConfigured } from "@/services/api";

export const Route = createFileRoute("/admin/discounts")({
  head: () => ({
    meta: [
      { title: "Discounts (Demo) | Being You – Always Admin" },
      { name: "description", content: "Create discount codes and preview how they apply (demo)." },
      { property: "og:title", content: "Discounts | Being You – Always Admin" },
      { property: "og:description", content: "Discount code manager (demo)." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (isBackendConfigured() ? <LiveDiscounts /> : <Discounts />),
});

const num = (v: string) => (v === "" ? undefined : Number(v));

function Discounts() {
  const list = useDemoStore(discountStore);
  const [d, setD] = useState<Discount>(blankDiscount);
  const [del, setDel] = useState<Discount | null>(null);
  const [bag, setBag] = useState(1200);
  const editing = list.some((x) => x.id === d.id);
  const up = (p: Partial<Discount>) => setD({ ...d, ...p });
  const errors = validateDiscount({ ...d, code: d.code.trim().toUpperCase() }, list);
  const check = evaluateDiscount(d, bag);

  return (
    <AdminPage title="Discounts & offers" actions={<NotConnected label="Checkout validation needs backend" />} subtitle="Set up codes and preview the maths. Codes are not applied at checkout until the Hostinger backend validates them.">
      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <Panel title={editing ? `Edit ${d.code}` : "Create discount"} action={editing ? <Button size="sm" variant="outline" onClick={() => setD(blankDiscount())}><Plus /> New</Button> : undefined}>
          <form className="space-y-3" noValidate onSubmit={(e) => {
            e.preventDefault();
            try { const saved = discountService.save(d); toast(`${saved.code} saved${saved.active ? "" : " (inactive)"} — demo only`); setD(blankDiscount()); } catch (err) { toast.error((err as Error).message); }
          }}>
            <div><label htmlFor="dc" className={adminLabel}>Discount code</label><input id="dc" className={`${adminInput} uppercase`} value={d.code} maxLength={20} placeholder="e.g. WELCOME10" onChange={(e) => up({ code: e.target.value.toUpperCase().replace(/\s/g, "") })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="dt" className={adminLabel}>Type</label><select id="dt" className={adminInput} value={d.type} onChange={(e) => up({ type: e.target.value as Discount["type"] })}><option value="percent">Percentage (%)</option><option value="fixed">Fixed amount (₹)</option></select></div>
              <div><label htmlFor="dv" className={adminLabel}>{d.type === "percent" ? "Percent off" : "Amount off (₹)"}</label><input id="dv" type="number" min={0} className={adminInput} value={d.value} onChange={(e) => up({ value: Number(e.target.value) })} /></div>
              <div><label htmlFor="dm" className={adminLabel}>Minimum order (₹)</label><input id="dm" type="number" min={0} className={adminInput} value={d.minOrder ?? ""} placeholder="None" onChange={(e) => up({ minOrder: num(e.target.value) })} /></div>
              <div><label htmlFor="dx" className={adminLabel}>Maximum discount (₹)</label><input id="dx" type="number" min={0} className={adminInput} value={d.maxDiscount ?? ""} placeholder="No cap" onChange={(e) => up({ maxDiscount: num(e.target.value) })} /></div>
              <div><label htmlFor="ds" className={adminLabel}>Starts</label><input id="ds" type="date" className={adminInput} value={d.startsAt ?? ""} onChange={(e) => up({ startsAt: e.target.value || undefined })} /></div>
              <div><label htmlFor="de" className={adminLabel}>Expires</label><input id="de" type="date" className={adminInput} value={d.endsAt ?? ""} onChange={(e) => up({ endsAt: e.target.value || undefined })} /></div>
              <div><label htmlFor="du" className={adminLabel}>Usage limit</label><input id="du" type="number" min={1} className={adminInput} value={d.usageLimit ?? ""} placeholder="Unlimited" onChange={(e) => up({ usageLimit: num(e.target.value) })} /></div>
              <label className="flex items-end justify-between gap-2 pb-2 text-sm">Active <Switch checked={d.active} onCheckedChange={(v) => up({ active: v })} aria-label="Active" /></label>
            </div>
            {d.code && errors.length > 0 && <ul className="list-disc space-y-0.5 pl-4 text-xs text-destructive">{errors.map((x) => <li key={x}>{x}</li>)}</ul>}
            <Button variant="lux" size="xl" className="w-full" type="submit">{editing ? "Save changes" : "Save discount"}</Button>
          </form>
        </Panel>
        <div className="space-y-4">
          <Panel title="Calculation preview">
            <div className="grid gap-4 sm:grid-cols-[200px_1fr] sm:items-center">
              <div><label htmlFor="bag" className={adminLabel}>Bag subtotal (₹)</label><input id="bag" type="number" min={0} className={adminInput} value={bag} onChange={(e) => setBag(Number(e.target.value))} /></div>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between"><dt>Subtotal</dt><dd>{inr(bag)}</dd></div>
                <div className="flex justify-between"><dt>{d.code || "Code"}</dt><dd>{check.ok ? `− ${inr(check.amount)}` : <span className="text-muted-foreground">{check.reason}</span>}</dd></div>
                <div className="flex justify-between border-t border-border pt-1 font-semibold"><dt>After discount</dt><dd>{inr(bag - check.amount)}</dd></div>
                <p className="text-[11px] text-muted-foreground">Shipping is not included — rates are pending confirmation.</p>
              </dl>
            </div>
          </Panel>
          <Panel title={`Codes (${list.length})`}>
            {list.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No discount codes yet — none have been agreed with the client.</p> : (
              <Table head={["Code", "Offer", "Conditions", "Dates", "Used", "Status", ""]}>
                {list.map((x) => (
                  <tr key={x.id}>
                    <Td className="font-mono font-semibold">{x.code}</Td>
                    <Td>{x.type === "percent" ? `${x.value}% off` : `${inr(x.value)} off`}{x.maxDiscount != null ? <div className="text-xs text-muted-foreground">max {inr(x.maxDiscount)}</div> : null}</Td>
                    <Td className="text-xs">{x.minOrder != null ? `Min ${inr(x.minOrder)}` : "No minimum"}</Td>
                    <Td className="text-xs">{x.startsAt ?? "now"} → {x.endsAt ?? "no expiry"}</Td>
                    <Td>{x.used}{x.usageLimit != null ? ` / ${x.usageLimit}` : ""}</Td>
                    <Td><Pill t={x.active ? "good" : "muted"}>{x.active ? "active" : "inactive"}</Pill></Td>
                    <Td className="whitespace-nowrap text-right">
                      <Button variant="ghost" size="icon" aria-label={`Edit ${x.code}`} onClick={() => setD(x)}><Pencil /></Button>
                      <Button variant="ghost" size="icon" aria-label={`Delete ${x.code}`} onClick={() => setDel(x)}><Trash2 className="text-destructive" /></Button>
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>
        </div>
      </div>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Delete ${del?.code ?? ""}?`} confirmLabel="Delete" description="The code is removed from this browser." onConfirm={() => { if (del) { discountService.remove(del.id); toast("Discount deleted"); } }} />
    </AdminPage>
  );
}
