import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useState } from "react";

import { DemoNotice } from "@/components/shop/DemoNotice";
import { Button } from "@/components/ui/button";
import { authService } from "@/services/authService";

export const Route = createFileRoute("/_site/login")({
  head: () => ({
    meta: [
      { title: "Login or Register | Being You – Always" },
      { name: "description", content: "Sign in to your Being You – Always account with your mobile number." },
      { property: "og:title", content: "Login | Being You – Always" },
      { property: "og:description", content: "Sign in with your mobile number." },
    ],
  }),
  component: Login,
});

function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  return (
    <div className="container-lux grid min-h-[70vh] place-items-center py-16">
      <div className="w-full max-w-md">
        <p className="eyebrow text-center">My account</p>
        <h1 className="mt-3 text-center text-5xl">{mode === "login" ? "Welcome back" : "Create account"}</h1>
        <div className="mt-8 grid grid-cols-2 rounded-full bg-secondary p-1">
          {(["login", "register"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m} className={`h-10 rounded-full text-xs font-semibold uppercase tracking-wider ${mode === m ? "bg-card shadow-soft" : "text-muted-foreground"}`}>{m === "login" ? "Login" : "Register"}</button>
          ))}
        </div>
        <form
          className="mt-8 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const digits = phone.replace(/\D/g, "");
            if (!/^[6-9]\d{9}$/.test(digits)) return setErr("Enter a valid 10-digit mobile number");
            if (mode === "register" && name.trim().length < 2) return setErr("Please enter your name");
            setErr("");
            await authService.requestOtp(digits);
            navigate({ to: "/verify-otp", search: { phone: digits } });
          }}
        >
          {mode === "register" && (
            <div>
              <label htmlFor="rname" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Full name</label>
              <input id="rname" value={name} onChange={(e) => setName(e.target.value)} className="h-12 w-full rounded-md border border-input bg-card px-4 text-sm" />
            </div>
          )}
          <div>
            <label htmlFor="lphone" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">WhatsApp mobile number</label>
            <div className="flex">
              <span className="grid h-12 place-items-center rounded-l-md border border-r-0 border-input bg-secondary px-3 text-sm">+91</span>
              <input id="lphone" type="tel" inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!err} className="h-12 w-full rounded-r-md border border-input bg-card px-4 text-sm" />
            </div>
            {err && <p className="mt-1.5 text-xs text-destructive">{err}</p>}
          </div>
          <Button variant="lux" size="xl" className="w-full" type="submit"><MessageCircle /> Send OTP on WhatsApp</Button>
        </form>
        <DemoNotice className="mt-6">Demo only — no OTP is sent. Live WhatsApp OTP verification will be enabled after backend integration.</DemoNotice>
      </div>
    </div>
  );
}
