import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useState } from "react";

import { adminInput, adminLabel } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { adminAuthService } from "@/services/adminAuthService";

export const Route = createFileRoute("/admin_/login")({
  head: () => ({
    meta: [
      { title: "Admin Sign-in (Demo) | Being You – Always" },
      { name: "description", content: "Sign-in screen for the Being You – Always store admin (demo)." },
      { property: "og:title", content: "Admin Sign-in | Being You – Always" },
      { property: "og:description", content: "Store admin sign-in (demo)." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div data-admin className="grid min-h-screen place-items-center bg-secondary/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-7 shadow-soft">
        <p className="font-serif text-3xl">Being You</p>
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Store admin</p>
        <div role="note" className="mt-5 flex gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-foreground">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p>This prototype has <strong>no secure sign-in</strong>. Anyone with the link can open the demo admin. Real administration stays disabled until the Hostinger server checks sign-in and roles.</p>
        </div>
        <form className="mt-6 space-y-4" noValidate onSubmit={async (e) => {
          e.preventDefault();
          const r = await adminAuthService.signIn(email.trim(), password);
          setMsg(r.reason === "invalid" ? "Enter a valid email and a password of at least 8 characters." : "Secure sign-in needs the Hostinger backend, which isn't connected yet. Nothing was checked or saved.");
          setPassword("");
        }}>
          <div><label htmlFor="ae" className={adminLabel}>Email</label><input id="ae" type="email" autoComplete="username" className={adminInput} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><label htmlFor="ap" className={adminLabel}>Password</label><input id="ap" type="password" autoComplete="current-password" className={adminInput} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <Button type="submit" variant="lux" size="xl" className="w-full">Sign in</Button>
          {msg && <p role="alert" className="text-xs text-destructive">{msg}</p>}
        </form>
        <div className="mt-6 border-t border-border pt-5">
          <Button type="button" variant="luxOutline" size="xl" className="w-full" onClick={() => { adminAuthService.enterDemo(); navigate({ to: "/admin" }); }}>Continue in demo mode</Button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">Demo mode lasts for this browser tab. Demo data only — no real customers, orders or payments.</p>
        </div>
      </div>
    </div>
  );
}
