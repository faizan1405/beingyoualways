import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DemoNotice } from "@/components/shop/DemoNotice";
import { Button, buttonVariants } from "@/components/ui/button";
import { isBackendConfigured } from "@/services/api";
import { DEMO_CUSTOMER_ID, customerService } from "@/services/customerService";
import { customerAuthService, type ShopperAccount } from "@/services/customerAuthService";

export const Route = createFileRoute("/_site/account/profile")({
  // Live: the signed-in shopper is read in the browser (the cookie never reaches server rendering).
  loader: async () => (isBackendConfigured() ? { live: true as const, demo: null } : { live: false as const, demo: (await customerService.get(DEMO_CUSTOMER_ID)) ?? null }),
  component: Profile,
});

const label = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const input = "h-12 w-full rounded-md border border-input bg-card px-4 text-sm disabled:opacity-60";

function Profile() {
  const data = Route.useLoaderData();
  if (data.live) return <LiveProfile />;
  const c = data.demo;
  if (!c) return <p className="text-sm text-muted-foreground">No sample profile in this preview.</p>;
  return (
    <form className="max-w-lg space-y-4" onSubmit={(e) => { e.preventDefault(); toast("Preview only — profile changes save once the store server is connected."); }}>
      <h2 className="text-3xl">Profile details</h2>
      {[["pname", "Full name", c.name], ["pemail", "Email", c.email], ["pphone", "Mobile", c.phone]].map(([id, l, v]) => (
        <div key={id}>
          <label htmlFor={id} className={label}>{l}</label>
          <input id={id} defaultValue={v} className={input} />
        </div>
      ))}
      <Button variant="lux" size="xl" type="submit">Save changes</Button>
    </form>
  );
}

/** Real profile: name and mobile are saved on the store server; email changes aren't offered here. */
function LiveProfile() {
  const [me, setMe] = useState<ShopperAccount | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    void customerAuthService.me().then((c) => {
      if (!alive) return;
      setMe(c);
      if (c) { setName(c.name); setPhone(c.phone ?? ""); }
    });
    return () => { alive = false; };
  }, []);

  if (me === undefined) return <p className="text-sm text-muted-foreground">Loading your details…</p>;
  if (me === null) {
    return (
      <div>
        <h2 className="text-3xl">Profile details</h2>
        <DemoNotice className="mt-5">Please sign in to see and change your details.</DemoNotice>
        <Link to="/login" className={`${buttonVariants({ variant: "lux", size: "lg" })} mt-6`}>Sign in</Link>
      </div>
    );
  }

  const digits = phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  const phoneChanged = digits !== (me.phone ?? "");
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (name.trim().length < 2) { setErr("Enter your name."); return; }
    if (digits && !/^[6-9]\d{9}$/.test(digits)) { setErr("Enter a valid 10-digit Indian mobile number, or leave it empty."); return; }
    setBusy(true);
    const r = await customerAuthService.profile({ name: name.trim(), phone: digits || null });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setMe(r.customer);
    toast("Your details are saved");
  };

  return (
    <form className="max-w-lg space-y-4" onSubmit={save} noValidate>
      <h2 className="text-3xl">Profile details</h2>
      <div>
        <label htmlFor="pname" className={label}>Full name</label>
        <input id="pname" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={input} />
      </div>
      <div>
        <label htmlFor="pemail" className={label}>Email</label>
        <input id="pemail" value={me.email ?? ""} disabled readOnly className={input} aria-describedby="pemail-note" />
        <p id="pemail-note" className="mt-1 text-xs text-muted-foreground">{me.email ? (me.emailVerified ? "Confirmed." : "Not confirmed yet — see the email we sent.") : "No email on this account."}</p>
      </div>
      <div>
        <label htmlFor="pphone" className={label}>Mobile</label>
        <input id="pphone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel-national" className={input} aria-describedby="pphone-note" />
        <p id="pphone-note" className="mt-1 text-xs text-muted-foreground">
          {phoneChanged ? "After saving a new number, sign in once with WhatsApp to confirm it before bag reminders can use it." : "Used for delivery updates you've agreed to."}
        </p>
      </div>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Button variant="lux" size="xl" type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
    </form>
  );
}
