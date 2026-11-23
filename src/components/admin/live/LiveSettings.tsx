import { CheckCircle2, CircleAlert } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { AdminPage, Panel, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { INDIAN_STATES } from "@/lib/checkout-validation";
import { adminCommerce, paiseToRupeesText, rupeesToPaise, type AllSettings, type CodSettings, type ShippingSettings } from "@/services/adminCommerceService";
import { LiveState, useLive } from "./shared";

const lines = (s: string) => s.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
const money = (s: string, label: string) => { const p = rupeesToPaise(s); if (Number.isNaN(p)) throw new Error(`${label} must be a number.`); return p; };
const intOrNull = (s: string) => (s.trim() === "" ? null : Math.floor(Number(s)));

function Ready({ problems, ok }: { problems: string[]; ok: string }) {
  return problems.length === 0
    ? <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="size-4" /> {ok}</p>
    : <ul className="space-y-1 text-sm text-destructive">{problems.map((p) => <li key={p} className="flex gap-2"><CircleAlert className="mt-0.5 size-4 shrink-0" /> {p}</li>)}</ul>;
}
const F = ({ id, label, children, hint }: { id: string; label: string; children: ReactNode; hint?: string }) => (
  <div><label className={adminLabel} htmlFor={id}>{label}</label>{children}{hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}</div>
);

/** Owner-controlled shipping, Cash on Delivery and contact settings, saved in MySQL and used by checkout. */
export function LiveSettings() {
  const { data, setData, error, loading, reload } = useLive(() => adminCommerce.settings(), []);
  if (!data) return <AdminPage title="Settings"><LiveState error={error} loading={loading} onRetry={() => void reload()} /></AdminPage>;
  return <SettingsForms s={data} onSaved={setData} />;
}

function SettingsForms({ s, onSaved }: { s: AllSettings; onSaved: (s: AllSettings) => void }) {
  const r = s.readiness;
  const [busy, setBusy] = useState<string | null>(null);
  const [ship, setShip] = useState(() => ({ enabled: s.shipping.enabled, fee: paiseToRupeesText(s.shipping.flatFeePaise), free: paiseToRupeesText(s.shipping.freeAbovePaise), mode: s.shipping.regions.mode, states: s.shipping.regions.states, pins: s.shipping.regions.pincodePrefixes.join(", "), min: s.shipping.estimateMinDays?.toString() ?? "", max: s.shipping.estimateMaxDays?.toString() ?? "", note: s.shipping.estimateNote, qty: String(s.shipping.maxQtyPerLine) }));
  const [cod, setCod] = useState(() => ({ enabled: s.cod.enabled, fee: paiseToRupeesText(s.cod.feePaise), min: paiseToRupeesText(s.cod.minOrderPaise), max: paiseToRupeesText(s.cod.maxOrderPaise), mode: s.cod.regions.mode, states: s.cod.regions.states, pins: s.cod.regions.pincodePrefixes.join(", ") }));
  const [store, setStore] = useState(s.store);
  useEffect(() => setStore(s.store), [s.store]);

  const save = async (kind: "shipping" | "cod" | "store", build: () => unknown) => {
    setBusy(kind);
    try { onSaved(await adminCommerce.saveSettings(kind, build())); toast("Saved to the store database"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Not saved."); } finally { setBusy(null); }
  };
  const submitShip = (e: FormEvent) => { e.preventDefault(); void save("shipping", (): ShippingSettings => ({
    enabled: ship.enabled, flatFeePaise: money(ship.fee, "Shipping charge"), freeAbovePaise: money(ship.free, "Free-shipping amount"),
    regions: { mode: ship.mode, states: ship.mode === "states" ? ship.states : [], pincodePrefixes: ship.mode === "pincodes" ? lines(ship.pins) : [] },
    estimateMinDays: intOrNull(ship.min), estimateMaxDays: intOrNull(ship.max), estimateNote: ship.note, maxQtyPerLine: Math.max(1, Math.floor(Number(ship.qty) || 10)),
  })); };
  const submitCod = (e: FormEvent) => { e.preventDefault(); void save("cod", (): CodSettings => ({
    enabled: cod.enabled, feePaise: money(cod.fee, "COD charge"), minOrderPaise: money(cod.min, "COD minimum"), maxOrderPaise: money(cod.max, "COD maximum"),
    regions: { mode: cod.mode, states: cod.mode === "states" ? cod.states : [], pincodePrefixes: cod.mode === "pincodes" ? lines(cod.pins) : [] },
  })); };

  const stateBoxes = (sel: string[], set: (v: string[]) => void) => (
    <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-input p-3 text-sm sm:grid-cols-2">
      {INDIAN_STATES.map((st) => <label key={st} className="flex items-center gap-2"><input type="checkbox" checked={sel.includes(st)} onChange={(e) => set(e.target.checked ? [...sel, st] : sel.filter((x) => x !== st))} /> {st}</label>)}
    </div>
  );

  return (
    <AdminPage title="Settings" subtitle="These rules are saved in the store database and used by checkout immediately. Amounts are in rupees; nothing is filled in for you.">
      <Panel title="Shipping">
        <Ready problems={r.shipping} ok="Shipping is set up — customers can place orders." />
        <form onSubmit={submitShip} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="flex items-center gap-2 text-sm sm:col-span-2 xl:col-span-4"><input type="checkbox" checked={ship.enabled} onChange={(e) => setShip({ ...ship, enabled: e.target.checked })} /> Accept orders for delivery</label>
          <F id="sfee" label="Shipping charge (₹)" hint="Enter 0 for always-free shipping."><input id="sfee" inputMode="decimal" className={adminInput} value={ship.fee} onChange={(e) => setShip({ ...ship, fee: e.target.value })} /></F>
          <F id="sfree" label="Free shipping from (₹)" hint="Order value after discount. Blank = no free-shipping threshold."><input id="sfree" inputMode="decimal" className={adminInput} value={ship.free} onChange={(e) => setShip({ ...ship, free: e.target.value })} /></F>
          <F id="smin" label="Delivery estimate — earliest (working days)"><input id="smin" inputMode="numeric" className={adminInput} value={ship.min} onChange={(e) => setShip({ ...ship, min: e.target.value })} /></F>
          <F id="smax" label="Delivery estimate — latest (working days)"><input id="smax" inputMode="numeric" className={adminInput} value={ship.max} onChange={(e) => setShip({ ...ship, max: e.target.value })} /></F>
          <F id="snote" label="Delivery note shown at checkout (optional)"><input id="snote" maxLength={200} className={adminInput} value={ship.note} onChange={(e) => setShip({ ...ship, note: e.target.value })} /></F>
          <F id="sqty" label="Most units of one item per order"><input id="sqty" inputMode="numeric" className={adminInput} value={ship.qty} onChange={(e) => setShip({ ...ship, qty: e.target.value })} /></F>
          <F id="smode" label="Where you deliver"><select id="smode" className={adminInput} value={ship.mode} onChange={(e) => setShip({ ...ship, mode: e.target.value as typeof ship.mode })}><option value="all_india">All of India</option><option value="states">Selected states</option><option value="pincodes">Selected PIN codes</option></select></F>
          {ship.mode === "states" && <div className="sm:col-span-2 xl:col-span-4">{stateBoxes(ship.states, (v) => setShip({ ...ship, states: v }))}</div>}
          {ship.mode === "pincodes" && <div className="sm:col-span-2 xl:col-span-4"><F id="spins" label="PIN codes or prefixes (comma or space separated)" hint="e.g. 560 covers every PIN code starting with 560."><textarea id="spins" rows={3} className={`${adminInput} h-auto py-2`} value={ship.pins} onChange={(e) => setShip({ ...ship, pins: e.target.value })} /></F></div>}
          <div className="sm:col-span-2 xl:col-span-4 flex justify-end"><Button type="submit" variant="lux" disabled={busy === "shipping"}>Save shipping</Button></div>
        </form>
      </Panel>

      <Panel title="Cash on Delivery">
        <Ready problems={r.cod} ok="Cash on Delivery is available at checkout." />
        <form onSubmit={submitCod} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="flex items-center gap-2 text-sm sm:col-span-2 xl:col-span-4"><input type="checkbox" checked={cod.enabled} onChange={(e) => setCod({ ...cod, enabled: e.target.checked })} /> Offer Cash on Delivery</label>
          <F id="cfee" label="COD charge (₹)" hint="Enter 0 if there is no extra charge."><input id="cfee" inputMode="decimal" className={adminInput} value={cod.fee} onChange={(e) => setCod({ ...cod, fee: e.target.value })} /></F>
          <F id="cmin" label="Minimum order for COD (₹, optional)"><input id="cmin" inputMode="decimal" className={adminInput} value={cod.min} onChange={(e) => setCod({ ...cod, min: e.target.value })} /></F>
          <F id="cmax" label="Maximum order for COD (₹, optional)"><input id="cmax" inputMode="decimal" className={adminInput} value={cod.max} onChange={(e) => setCod({ ...cod, max: e.target.value })} /></F>
          <F id="cmode" label="Where COD is offered"><select id="cmode" className={adminInput} value={cod.mode} onChange={(e) => setCod({ ...cod, mode: e.target.value as typeof cod.mode })}><option value="all_shipping">Everywhere you deliver</option><option value="states">Selected states</option><option value="pincodes">Selected PIN codes</option></select></F>
          {cod.mode === "states" && <div className="sm:col-span-2 xl:col-span-4">{stateBoxes(cod.states, (v) => setCod({ ...cod, states: v }))}</div>}
          {cod.mode === "pincodes" && <div className="sm:col-span-2 xl:col-span-4"><F id="cpins" label="PIN codes or prefixes for COD"><textarea id="cpins" rows={3} className={`${adminInput} h-auto py-2`} value={cod.pins} onChange={(e) => setCod({ ...cod, pins: e.target.value })} /></F></div>}
          <div className="sm:col-span-2 xl:col-span-4 flex justify-end"><Button type="submit" variant="lux" disabled={busy === "cod"}>Save Cash on Delivery</Button></div>
        </form>
      </Panel>

      <Panel title="Online payments (Razorpay)">
        {r.razorpay.configured
          ? <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="size-4" /> Connected in <strong>{r.razorpay.mode === "live" ? "LIVE" : "TEST"}</strong> mode (key {r.razorpay.keyId}). Webhook secret {r.razorpay.webhookSecretSet ? "set" : "missing"}.</p>
          : <Ready problems={["Razorpay keys are not set on the server. Add RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET in Hostinger (never here)."]} ok="" />}
        {r.razorpay.mode === "test" && <p className="mt-2 text-xs text-muted-foreground">Test mode: online orders are marked as test orders and never counted as sales.</p>}
        {r.storeTestMode && <p className="mt-2 text-xs text-destructive">This server runs as a TEST store — every new order is a test order.</p>}
        <p className="mt-2 text-xs text-muted-foreground">Keys are entered only in the Hostinger server settings. This page never shows or stores secrets.</p>
      </Panel>

      <Panel title="Store contact (shown to customers)">
        <form onSubmit={(e) => { e.preventDefault(); void save("store", () => store); }} className="grid gap-4 sm:grid-cols-3">
          <F id="semail" label="Support email"><input id="semail" type="email" className={adminInput} value={store.contactEmail} onChange={(e) => setStore({ ...store, contactEmail: e.target.value })} /></F>
          <F id="sphone" label="Support phone"><input id="sphone" className={adminInput} value={store.contactPhone} onChange={(e) => setStore({ ...store, contactPhone: e.target.value })} /></F>
          <F id="ssupport" label="Support note (optional)"><input id="ssupport" maxLength={300} className={adminInput} value={store.supportNote} onChange={(e) => setStore({ ...store, supportNote: e.target.value })} /></F>
          <div className="sm:col-span-3 flex justify-end"><Button type="submit" variant="lux" disabled={busy === "store"}>Save contact</Button></div>
        </form>
      </Panel>
    </AdminPage>
  );
}
