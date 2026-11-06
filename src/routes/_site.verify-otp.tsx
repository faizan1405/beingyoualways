import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { DemoNotice } from "@/components/shop/DemoNotice";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { authService } from "@/services/authService";

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

function Verify() {
  const { phone } = Route.useSearch();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const navigate = useNavigate();
  return (
    <div className="container-lux grid min-h-[70vh] place-items-center py-16">
      <div className="w-full max-w-md text-center">
        <h1 className="text-5xl">Enter your code</h1>
        <p className="mt-3 text-sm text-muted-foreground">A 6-digit code would be sent on WhatsApp to +91 {phone ?? "XXXXXXXXXX"}.</p>
        <div className="mt-8 flex justify-center">
          <InputOTP maxLength={6} value={code} onChange={setCode} aria-label="One-time password">
            <InputOTPGroup>{[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} className="size-12 text-lg" />)}</InputOTPGroup>
          </InputOTP>
        </div>
        {err && <p className="mt-3 text-xs text-destructive">{err}</p>}
        <Button
          variant="lux" size="xl" className="mt-8 w-full"
          onClick={async () => {
            const r = await authService.verifyOtp(phone ?? "", code);
            if (!r.ok) return setErr("Please enter all 6 digits");
            navigate({ to: "/account" });
          }}
        >Verify & continue (demo)</Button>
        <button className="mt-4 text-xs text-muted-foreground underline" onClick={() => setErr("Resend is disabled in the demo.")}>Resend code</button>
        <DemoNotice className="mt-8 text-left">Live OTP verification will be enabled after backend integration. Any 6 digits open the demo account — this is not secure sign-in.</DemoNotice>
      </div>
    </div>
  );
}
