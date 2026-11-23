import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DemoNotice } from "@/components/shop/DemoNotice";
import { Button } from "@/components/ui/button";
import { isBackendConfigured } from "@/services/api";
import { DEMO_CUSTOMER_ID, customerService } from "@/services/customerService";
import { customerAuthService, type ShopperAddress } from "@/services/customerAuthService";

export const Route = createFileRoute("/_site/account/addresses")({
  loader: async () => {
    if (isBackendConfigured()) {
      const r = await customerAuthService.addresses();
      return { live: true as const, demo: [], error: r.ok ? null : r.error, server: r.ok ? r.addresses : [] };
    }
    return { live: false as const, demo: (await customerService.get(DEMO_CUSTOMER_ID))!.addresses, error: null, server: [] };
  },
  component: Addresses,
});

const empty = { label: "Home", name: "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "" };

function Addresses() {
  const { live, demo, server, error } = Route.useLoaderData();
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [list, setList] = useState<ShopperAddress[]>(server);

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (form.name.trim().length < 2) { setErr("Enter the recipient's name."); return; }
    if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, ""))) { setErr("Enter a valid 10-digit mobile number."); return; }
    if (form.line1.trim().length < 3) { setErr("Enter the flat / house and street."); return; }
    if (!form.city.trim() || !form.state.trim()) { setErr("Enter the city and state."); return; }
    if (!/^\d{6}$/.test(form.pincode.trim())) { setErr("Enter a valid 6-digit PIN code."); return; }
    setBusy(true);
    const r = await customerAuthService.addAddress({
      label: form.label.trim() || "Home",
      name: form.name.trim(),
      phone: form.phone.replace(/\D/g, ""),
      line1: form.line1.trim(),
      line2: form.line2.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
      isDefault: list.length === 0,
    });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setList((all) => [...all.filter((a) => a.id !== r.address.id), r.address]);
    setForm(empty);
    toast("Address saved.");
  };

  const remove = async (id: string) => {
    const r = await customerAuthService.deleteAddress(id);
    if (!r.ok) { toast(r.error); return; }
    setList((all) => all.filter((a) => a.id !== id));
    toast("Address removed.");
  };

  if (live) {
    return (
      <div>
        <h2 className="text-3xl">Saved addresses</h2>
        {error && <DemoNotice className="mt-5">{error}</DemoNotice>}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {list.map((a) => (
            <div key={a.id} className="rounded-lg border border-border p-5 text-sm">
              <p className="flex items-center gap-2 font-semibold">{a.label}{a.isDefault && <span className="rounded-full bg-secondary px-2 text-[10px] uppercase">Default</span>}</p>
              <p className="mt-2">{a.name}</p>
              <p className="text-muted-foreground">{a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.pincode}</p>
              <p className="text-muted-foreground">{a.phone}</p>
              <button onClick={() => remove(a.id)} className="mt-3 text-xs text-muted-foreground underline">Remove</button>
            </div>
          ))}
          {list.length === 0 && !error && <p className="text-sm text-muted-foreground">No saved addresses yet.</p>}
        </div>
        <form onSubmit={add} className="mt-8 space-y-4 rounded-lg border border-border p-5">
          <p className="text-sm font-semibold">Add an address</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="alabel" label="Label" value={form.label} onChange={set("label")} />
            <Field id="aname" label="Recipient name" value={form.name} onChange={set("name")} />
            <Field id="aphone" label="Mobile number" value={form.phone} onChange={set("phone")} />
            <Field id="apin" label="PIN code" value={form.pincode} onChange={set("pincode")} />
            <div className="sm:col-span-2"><Field id="aline1" label="Flat / house and street" value={form.line1} onChange={set("line1")} /></div>
            <div className="sm:col-span-2"><Field id="aline2" label="Area / landmark (optional)" value={form.line2} onChange={set("line2")} /></div>
            <Field id="acity" label="City" value={form.city} onChange={set("city")} />
            <Field id="astate" label="State" value={form.state} onChange={set("state")} />
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <Button variant="lux" size="lg" type="submit" disabled={busy}><Plus className="size-4" /> {busy ? "Saving…" : "Save address"}</Button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl">Saved addresses</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {demo.map((a) => (
          <div key={a.id} className="rounded-lg border border-border p-5 text-sm">
            <p className="flex items-center gap-2 font-semibold">{a.label}{a.isDefault && <span className="rounded-full bg-secondary px-2 text-[10px] uppercase">Default</span>}</p>
            <p className="mt-2">{a.name}</p>
            <p className="text-muted-foreground">{a.line1}, {a.city}, {a.state} {a.pincode}</p>
            <p className="text-muted-foreground">{a.phone}</p>
          </div>
        ))}
        <button onClick={() => toast("Adding addresses needs the backend.")} className="flex min-h-32 items-center justify-center gap-2 rounded-lg border border-dashed border-input text-sm text-muted-foreground hover:border-primary"><Plus className="size-4" /> Add address</button>
      </div>
    </div>
  );
}

function Field({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input id={id} value={value} onChange={onChange} className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm" />
    </div>
  );
}
