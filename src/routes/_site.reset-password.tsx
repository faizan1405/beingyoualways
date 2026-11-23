import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { DemoNotice } from "@/components/shop/DemoNotice";
import { Button, buttonVariants } from "@/components/ui/button";
import { isBackendConfigured } from "@/services/api";
import { customerAuthService } from "@/services/customerAuthService";

export const Route = createFileRoute("/_site/reset-password")({
  validateSearch: (s: Record<string, unknown>): { token?: string | undefined } => ({ token: typeof s["token"] === "string" ? s["token"] : undefined }),
  head: () => ({
    meta: [
      { title: "Choose a new password | Being You – Always" },
      { name: "description", content: "Set a new password for your Being You – Always account." },
      { property: "og:title", content: "Choose a new password | Being You – Always" },
      { property: "og:description", content: "Password reset for your account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const { token } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 10) return setErr("Use at least 10 characters.");
    if (password !== again) return setErr("The two passwords don't match.");
    setErr("");
    setBusy(true);
    const r = await customerAuthService.resetPassword({ token: token ?? "", password });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setDone(true);
  };

  return (
    <div className="container-lux grid min-h-[60vh] place-items-center py-16">
      <div className="w-full max-w-md">
        <p className="eyebrow text-center">My account</p>
        <h1 className="mt-3 text-center text-5xl">Choose a new password</h1>
        {done ? (
          <>
            <p className="mt-5 text-center text-sm text-muted-foreground">Your new password is set. Every other device was signed out.</p>
            <div className="mt-8 grid place-items-center"><Link to="/login" className={buttonVariants({ variant: "lux", size: "xl" })}>Sign in</Link></div>
          </>
        ) : !token ? (
          <>
            <p className="mt-5 text-center text-sm text-muted-foreground">That reset link is missing its code. Ask for a new link.</p>
            <div className="mt-8 grid place-items-center"><Link to="/login" className={buttonVariants({ variant: "outline", size: "lg" })}>Back to sign in</Link></div>
          </>
        ) : (
          <form className="mt-8 space-y-4" onSubmit={submit}>
            <div>
              <label htmlFor="np" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">New password</label>
              <input id="np" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="h-12 w-full rounded-md border border-input bg-card px-4 text-sm" />
            </div>
            <div>
              <label htmlFor="np2" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type it again</label>
              <input id="np2" type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" aria-invalid={!!err} className="h-12 w-full rounded-md border border-input bg-card px-4 text-sm" />
              {err && <p className="mt-1.5 text-xs text-destructive">{err}</p>}
            </div>
            <Button variant="lux" size="xl" className="w-full" type="submit" disabled={busy}>{busy ? "Saving…" : "Set new password"}</Button>
          </form>
        )}
        {!isBackendConfigured() && <DemoNotice className="mt-6">Password reset needs the store server, which isn't connected in this preview. No password was changed.</DemoNotice>}
      </div>
    </div>
  );
}
