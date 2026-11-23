import { Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AdminPage, Panel, Table, Td, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { inrPaise } from "@/lib/format";
import { productService } from "@/services/productService";
import { adminCommerce, paiseToRupeesText, rupeesToPaise, type AdminDiscount, type DiscountInput } from "@/services/adminCommerceService";
import { LiveState, istDate, useLive } from "./shared";

type Form = { code: string; description: string; type: "PERCENT" | "FIXED"; amount: string; min: string; max: string; startsAt: string; endsAt: string; limit: string; active: boolean; categories: string[] };
const empty: Form = { code: "", description: "", type: "PERCENT", amount: "", min: "", max: "", startsAt: "", endsAt: "", limit: "", active: false, categories: [] };
const toForm = (d: AdminDiscount): Form => ({
  code: d.code, description: d.description, type: d.type, amount: d.type === "PERCENT" ? String(d.percentOff ?? "") : paiseToRupeesText(d.amountOffPaise),
  min: paiseToRupeesText(d.minOrderPaise), max: paiseToRupeesText(d.maxDiscountPaise), startsAt: d.startsAt?.slice(0, 10) ?? "", endsAt: d.endsAt?.slice(0, 10) ?? "",
  limit: d.usageLimit == null ? "" : String(d.usageLimit), active: d.active, categories: d.categorySlugs ?? [],
});
/** India-time day boundaries for validity dates. */
const toInput = (f: Form): DiscountInput | string => {
  const min = rupeesToPaise(f.min), max = rupeesToPaise(f.max);
  if ([min, max].some((x) => Number.isNaN(x))) return "Amounts must be numbers.";
  const n = Number(f.amount);
  if (!(n > 0)) return f.type === "PERCENT" ? "Enter the percentage off." : "Enter the amount off.";
  return {
    code: f.code.trim().toUpperCase(), description: f.description.trim(), type: f.type,
    percentOff: f.type === "PERCENT" ? Math.round(n * 100) / 100 : null, amountOffPaise: f.type === "FIXED" ? Math.round(n * 100) : null,
    minOrderPaise: min, maxDiscountPaise: f.type === "PERCENT" ? max : null,
    startsAt: f.startsAt ? `${f.startsAt}T00:00:00+05:30` : null, endsAt: f.endsAt ? `${f.endsAt}T23:59:59+05:30` : null,
    usageLimit: f.limit.trim() ? Math.floor(Number(f.limit)) : null, active: f.active, productIds: null, categorySlugs: f.categories.length ? f.categories : null,
  };
};

/** Discount codes stored in MySQL and applied by the server at checkout. */
export function LiveDiscounts() {
  const { data, setData, error, loading, reload } = useLive(() => adminCommerce.discounts(), []);
  const [editing, setEditing] = useState<{ id: string | null; f: Form } | null>(null);
  const [busy, setBusy] = useState(false);
  const [categories, setCategories] = useState<{ slug: string; name: string }[]>([]);
  useEffect(() => { void productService.categories().then((c) => setCategories(c.map(({ slug, name }) => ({ slug, name })))); }, []);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const input = toInput(editing.f);
    if (typeof input === "string") { toast.error(input); return; }
    setBusy(true);
    try {
      const d = editing.id ? await adminCommerce.updateDiscount(editing.id, input) : await adminCommerce.createDiscount(input);
      setData((list) => (list ? (editing.id ? list.map((x) => (x.id === d.id ? d : x)) : [d, ...list]) : [d]));
      setEditing(null); toast(`Saved ${d.code}`);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Not saved."); } finally { setBusy(false); }
  };
  const toggle = async (d: AdminDiscount) => {
    try { const u = await adminCommerce.updateDiscount(d.id, { ...(toInput({ ...toForm(d), active: !d.active }) as DiscountInput), productIds: d.productIds }); setData((l) => l?.map((x) => (x.id === u.id ? u : x)) ?? null); toast(`${u.code} switched ${u.active ? "on" : "off"}`); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Not saved."); }
  };
  const f = editing?.f;
  const setF = (p: Partial<Form>) => setEditing((e) => (e ? { ...e, f: { ...e.f, ...p } } : e));
  return (
    <AdminPage title="Discount codes" subtitle="Checked and applied by the server at checkout — shoppers can't change the amount."
      actions={<Button variant="lux" size="xl" onClick={() => setEditing({ id: null, f: empty })}><Plus /> New code</Button>}>
      {editing && f && (
        <Panel title={editing.id ? `Edit ${f.code}` : "New discount code"}>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div><label className={adminLabel} htmlFor="dcode">Code</label><input id="dcode" required minLength={3} maxLength={40} pattern="[A-Za-z0-9_-]+" className={`${adminInput} uppercase`} value={f.code} onChange={(e) => setF({ code: e.target.value })} /></div>
            <div><label className={adminLabel} htmlFor="dtype">Type</label><select id="dtype" className={adminInput} value={f.type} onChange={(e) => setF({ type: e.target.value as Form["type"] })}><option value="PERCENT">Percentage off</option><option value="FIXED">Fixed amount off (₹)</option></select></div>
            <div><label className={adminLabel} htmlFor="damt">{f.type === "PERCENT" ? "Percent off" : "Amount off (₹)"}</label><input id="damt" inputMode="decimal" required className={adminInput} value={f.amount} onChange={(e) => setF({ amount: e.target.value })} /></div>
            {f.type === "PERCENT" && <div><label className={adminLabel} htmlFor="dmax">Max discount (₹, optional)</label><input id="dmax" inputMode="decimal" className={adminInput} value={f.max} onChange={(e) => setF({ max: e.target.value })} /></div>}
            <div><label className={adminLabel} htmlFor="dmin">Minimum order (₹, optional)</label><input id="dmin" inputMode="decimal" className={adminInput} value={f.min} onChange={(e) => setF({ min: e.target.value })} /></div>
            <div><label className={adminLabel} htmlFor="dlim">Total uses allowed (optional)</label><input id="dlim" inputMode="numeric" className={adminInput} value={f.limit} onChange={(e) => setF({ limit: e.target.value })} /></div>
            <div><label className={adminLabel} htmlFor="dfrom">Valid from</label><input id="dfrom" type="date" className={adminInput} value={f.startsAt} onChange={(e) => setF({ startsAt: e.target.value })} /></div>
            <div><label className={adminLabel} htmlFor="dto">Valid until</label><input id="dto" type="date" className={adminInput} value={f.endsAt} onChange={(e) => setF({ endsAt: e.target.value })} /></div>
            <fieldset className="sm:col-span-2"><legend className={adminLabel}>Only for categories (none ticked = whole shop)</legend>
              <div className="flex flex-wrap gap-3 text-sm">{categories.map((c) => <label key={c.slug} className="flex items-center gap-1.5"><input type="checkbox" checked={f.categories.includes(c.slug)} onChange={(e) => setF({ categories: e.target.checked ? [...f.categories, c.slug] : f.categories.filter((x) => x !== c.slug) })} /> {c.name}</label>)}</div>
            </fieldset>
            <div className="sm:col-span-2"><label className={adminLabel} htmlFor="ddesc">Internal description</label><input id="ddesc" maxLength={200} className={adminInput} value={f.description} onChange={(e) => setF({ description: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.active} onChange={(e) => setF({ active: e.target.checked })} /> Active — shoppers can use it now</label>
            <div className="flex gap-2 sm:col-span-2 sm:justify-end"><Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" variant="lux" disabled={busy}>Save code</Button></div>
          </form>
        </Panel>
      )}
      <Panel>
        <LiveState error={error} loading={loading && !data} onRetry={() => void reload()} />
        {data && data.length > 0 && (
          <Table head={["Code", "Discount", "Rules", "Used", "Valid", "Status", ""]}>
            {data.map((d) => (
              <tr key={d.id}>
                <Td><span className="font-semibold">{d.code}</span><div className="text-xs text-muted-foreground">{d.description}</div></Td>
                <Td>{d.type === "PERCENT" ? `${d.percentOff}% off${d.maxDiscountPaise ? ` (max ${inrPaise(d.maxDiscountPaise)})` : ""}` : `${inrPaise(d.amountOffPaise ?? 0)} off`}</Td>
                <Td className="text-xs">{d.minOrderPaise ? `Min ${inrPaise(d.minOrderPaise)}` : "No minimum"}{d.categorySlugs?.length ? ` · ${d.categorySlugs.join(", ")}` : ""}</Td>
                <Td>{d.usedCount}{d.usageLimit != null ? ` / ${d.usageLimit}` : ""}</Td>
                <Td className="text-xs">{d.startsAt ? istDate(d.startsAt) : "Now"} – {d.endsAt ? istDate(d.endsAt) : "no end"}</Td>
                <Td><button type="button" className="text-sm underline" onClick={() => void toggle(d)}>{d.active ? "On" : "Off"}</button></Td>
                <Td><Button variant="outline" size="sm" onClick={() => setEditing({ id: d.id, f: toForm(d) })}>Edit</Button></Td>
              </tr>
            ))}
          </Table>
        )}
        {data && data.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No discount codes yet.</p>}
      </Panel>
    </AdminPage>
  );
}
