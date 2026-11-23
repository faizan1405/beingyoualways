import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { DemoNotice } from "@/components/shop/DemoNotice";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { OTP_POLICY, canRequestOtp } from "@/lib/whatsapp-cloud";
import { authService, isDemoSignIn, otpStateFor } from "@/services/authService";

export const Route = createFileRoute("/_site/verify-otp")({
  validateSearch: (s: Record<string, unknown>): { phone?: string | undefined} => ({ phone: typeof s["phone"] === "string" ? s["phone"] : undefined }),
  head: () => ({
    meta: [
      { title: "Verify OTP | Being You – Always" },
      { name: "description", content: "Verify the WhatsApp OTP sent to your mobile number." },
      { property: "og:title", content: "Verify OTP | Being You – Always" },
      { property: "og:description", content: "WhatsApp OTP verification." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Verify,
});

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function Verify() {
  const { phone } = Route.useSearch();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const navigate = useNavigate();
  const demo = isDemoSignIn();

  // Countdown only after hydration (reads this tab's saved send times).
  useEffect(() => { setNow(new Date()); const t = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(t); }, []);
  const st = now && phone ? otpStateFor(phone) : null;
  const expiresIn = st?.expiresAt && now ? Math.max(0, Math.ceil((new Date(st.expiresAt).getTime() - now.getTime()) / 1000)) : 0;
  const resend = st && now ? canRequestOtp(st, now) : null;
  const left = st ? OTP_POLICY.maxAttempts - st.failedAttempts : OTP_POLICY.maxAttempts;

  return (
    <div className="container-lux grid min-h-[70vh] place-items-center py-16">
      <div className="w-full max-w-md text-center">
        <h1 className="text-5xl">Enter your code</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {demo ? "In the live shop a 6-digit code is sent on WhatsApp to" : "We sent a 6-digit code on WhatsApp to"} +91 {phone ?? "XXXXXXXXXX"}.
        </p>
        {st?.expiresAt && <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">{expiresIn > 0 ? `Code valid for ${mmss(expiresIn)}` : "Code expired — ask for a new one."}</p>}
        <div className="mt-8 flex justify-center">
          <InputOTP maxLength={OTP_POLICY.codeLength} value={code} onChange={setCode} aria-label="One-time password">
            <InputOTPGroup>{Array.from({ length: OTP_POLICY.codeLength }, (_, i) => <InputOTPSlot key={i} index={i} className="size-12 text-lg" />)}</InputOTPGroup>
          </InputOTP>
        </div>
        {err && <p className="mt-3 text-xs text-destructive" role="alert">{err}</p>}
        <Button
          variant="lux" size="xl" className="mt-8 w-full" disabled={busy || !phone}
          onClick={async () => {
            setBusy(true);
            const r = await authService.verifyOtp(phone ?? "", code);
            setBusy(false);
            if (!r.ok) { setErr(r.error); return; }
            navigate({ to: "/account" });
          }}
        >{demo ? "Verify & continue (demo)" : "Verify & continue"}</Button>
        <button
          type="button"
          className="mt-4 text-xs text-muted-foreground underline disabled:no-underline disabled:opacity-60"
          disabled={!phone || (resend !== null && !resend.ok)}
          onClick={async () => {
            if (!phone) return;
            const r = await authService.requestOtp(phone);
            setErr(r.ok ? "" : r.error);
            setCode("");
            setNow(new Date());
          }}
        >
          {resend && !resend.ok && resend.reason === "cooldown" ? `Resend code in ${resend.retryInSeconds}s` : resend && !resend.ok ? "Resend unavailable for now" : "Resend code"}
        </button>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Codes expire after {OTP_POLICY.expirySeconds / 60} minutes · up to {OTP_POLICY.maxSendsPerHour} codes an hour · {left} wrong attempt{left === 1 ? "" : "s"} allowed before a {OTP_POLICY.lockoutMinutes}-minute pause.
        </p>
        {demo && <DemoNotice className="mt-8 text-left">Demo only — no code is sent and any 6 digits open the demo account. This is not secure sign-in and switches off automatically once the shop's server is connected.</DemoNotice>}
      </div>
    </div>
  );
}
