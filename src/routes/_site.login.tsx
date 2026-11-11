import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useState } from "react";

import { DemoNotice } from "@/components/shop/DemoNotice";
import { Button, buttonVariants } from "@/components/ui/button";
import { authService } from "@/services/authService";
import { toast } from "sonner";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
    </svg>
  );
}

export const Route = createFileRoute("/_site/login")({
  head: () => ({
    meta: [
      { title: "Login or Register | Being You – Always" },
      { name: "description", content: "Sign in to your Being You – Always account with Google or your WhatsApp mobile number." },
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
  const [googleNote, setGoogleNote] = useState(false);
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
        <button
          type="button"
          onClick={async () => {
            const r = await authService.signInWithGoogle();
            if (!r.ok) setGoogleNote(true);
            toast("Google sign-in needs backend integration — you have not been signed in.");
          }}
          className={buttonVariants({ variant: "outline", size: "xl", className: "mt-8 w-full gap-3 bg-card font-semibold" })}
        >
          <GoogleIcon /> {mode === "login" ? "Continue with Google" : "Sign up with Google"}
        </button>
        {googleNote && <DemoNotice className="mt-3">Google sign-in is ready in the design but not connected yet. No Google account was accessed and you are <strong>not signed in</strong>.</DemoNotice>}
        <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground"><span className="h-px flex-1 bg-border" /> or continue with WhatsApp <span className="h-px flex-1 bg-border" /></div>
        <form
          className="space-y-4"
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
        <p className="mt-5 text-center text-[11px] text-muted-foreground">By continuing you agree to our <Link to="/terms" className="underline">Terms & Conditions</Link> and <Link to="/privacy-policy" className="underline">Privacy Policy</Link>.</p>
        <DemoNotice className="mt-6">Demo only — no OTP is sent. Live WhatsApp OTP verification will be enabled after backend integration.</DemoNotice>
      </div>
    </div>
  );
}
