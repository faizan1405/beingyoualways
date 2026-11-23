import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { DemoNotice } from "@/components/shop/DemoNotice";
import { buttonVariants } from "@/components/ui/button";
import { customerAuthService } from "@/services/customerAuthService";
import { isBackendConfigured } from "@/services/api";

export const Route = createFileRoute("/_site/verify-email")({
  validateSearch: (s: Record<string, unknown>): { token?: string | undefined } => ({ token: typeof s["token"] === "string" ? s["token"] : undefined }),
  head: () => ({
    meta: [
      { title: "Confirm your email | Being You – Always" },
      { name: "description", content: "Confirm the email address on your Being You – Always account." },
      { property: "og:title", content: "Confirm your email | Being You – Always" },
      { property: "og:description", content: "Email confirmation for your account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyEmail,
});

function VerifyEmail() {
  const { token } = Route.useSearch();
  const [state, setState] = useState<"waiting" | "verified" | "failed">("waiting");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let live = true;
    if (!token) {
      setState("failed");
      setMessage("That confirmation link is missing its code. Ask for a new one from your account.");
      return;
    }
    void (async () => {
      const r = await customerAuthService.verifyEmail(token);
      if (!live) return;
      if (r.ok) {
        setState("verified");
        setMessage("Email confirmed. You can sign in and use your account.");
      } else {
        setState("failed");
        setMessage(r.error);
      }
    })();
    return () => { live = false; };
  }, [token]);

  return (
    <div className="container-lux grid min-h-[60vh] place-items-center py-16">
      <div className="w-full max-w-md text-center">
        <p className="eyebrow">My account</p>
        <h1 className="mt-3 text-5xl">{state === "verified" ? "Email confirmed" : state === "failed" ? "Couldn't confirm" : "Confirming…"}</h1>
        <p className="mt-5 text-sm text-muted-foreground">{message || "Checking the link you opened."}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/account" className={buttonVariants({ variant: "lux", size: "lg" })}>Go to my account</Link>
          <Link to="/login" className={buttonVariants({ variant: "outline", size: "lg" })}>Sign in</Link>
        </div>
        {!isBackendConfigured() && <DemoNotice className="mt-8">Email confirmation needs the store server, which isn't connected in this preview. Nothing has been confirmed.</DemoNotice>}
      </div>
    </div>
  );
}
