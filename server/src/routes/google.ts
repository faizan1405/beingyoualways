import { Router } from "express";
import { z } from "zod";

import type { Config } from "../config.js";
import { HttpError } from "../errors.js";
import { clearCustomerCookie, customerCookieOptions, setCustomerCookie } from "../middleware/customerAuth.js";
import { loginLimiter } from "../middleware/security.js";
import type { CustomerAuthService } from "../services/customerAuthService.js";
import type { GoogleAuth, GoogleState } from "../services/googleAuth.js";

const callbackSchema = z.object({
  code: z.string().trim().max(2048).optional(),
  state: z.string().trim().max(256).optional(),
  error: z.string().trim().max(120).optional(),
});

/** Why a Google sign-in stopped — the storefront shows a matching sentence for each reason. */
export type GoogleFailReason = "cancelled" | "expired" | "failed" | "password_account" | "linked_elsewhere" | "removed" | "blocked" | "unavailable" | "not_configured";

class GoogleSignInError extends Error {
  constructor(readonly reason: GoogleFailReason, message: string, readonly status = 400) {
    super(message);
  }
}

/**
 * Sign-in with Google. The account is only ever touched after Google's ID token has been verified
 * (signature, iss, aud, exp, nonce) and the address Google reports is one Google has confirmed.
 *
 * A Google address is never allowed to take over an account that was opened with a password the
 * store has never verified: that account has to sign in with its password first.
 */
export function googleRoutes(google: GoogleAuth, customers: CustomerAuthService, config: Config) {
  const r = Router();
  const limit = loginLimiter();

  const wantsJson = (req: { query: unknown }) => (req.query as { format?: string }).format === "json";
  const back = (res: import("express").Response, params: Record<string, string>) => {
    const url = new URL(`${config.publicSiteUrl}/login`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    res.redirect(302, url.toString());
  };

  r.get("/status", (_req, res) => {
    res.json({ configured: google.configured });
  });

  r.get("/start", limit, (req, res) => {
    const flow = google.start();
    res.cookie(google.stateCookie, google.seal({ state: flow.state, nonce: flow.nonce, verifier: flow.verifier, issuedAt: Date.now() }), {
      ...customerCookieOptions(config, flow.maxAgeMs),
      httpOnly: true,
    });
    if (wantsJson(req)) return res.json({ url: flow.url });
    return res.redirect(302, flow.url);
  });

  r.get("/callback", limit, async (req, res) => {
    const raw = (req.cookies as Record<string, string | undefined> | undefined)?.[google.stateCookie];
    // the flow cookie is single-use, and nobody stays signed in as a previous person during the switch
    clearCustomerCookie(res, config);
    res.clearCookie(google.stateCookie, customerCookieOptions(config));

    try {
      // signed with AUTH_SECRET, so a planted or edited cookie is simply ignored
      const stored: GoogleState | null = google.open(raw);
      const q = callbackSchema.safeParse(req.query);
      if (!q.success) throw new GoogleSignInError("failed", "Google's reply was malformed. Please try again.");
      if (q.data.error) throw new GoogleSignInError("cancelled", "Google cancelled the sign-in.");
      if (!stored || !q.data.state || stored.state !== q.data.state) throw new GoogleSignInError("expired", "That sign-in has expired. Please try again.");
      if (!q.data.code) throw new GoogleSignInError("failed", "Google didn't finish the sign-in. Please try again.");

      const identity = await google.complete(q.data.code, stored);

      let customer = await customers.findByGoogleSub(identity.sub);
      if (!customer) {
        const byEmail = await customers.findByEmail(identity.email);
        if (byEmail) {
          // Takeover guard: a password account whose address we never confirmed stays password-only
          // until somebody proves the password and connects Google from inside the account.
          if (byEmail.passwordHash && !byEmail.emailVerifiedAt) {
            throw new GoogleSignInError("password_account", "An account with this email was opened with a password. Sign in with that password first, then connect Google from your account.");
          }
          // an account already tied to a different Google identity is never re-pointed at this one
          if (byEmail.googleSub && byEmail.googleSub !== identity.sub) {
            throw new GoogleSignInError("linked_elsewhere", "This email is already connected to a different Google account.");
          }
          if (byEmail.deletedAt) throw new GoogleSignInError("removed", "This account has been removed.");
          customer = await customers.linkGoogleSub(byEmail.id, identity.sub);
        } else {
          customer = await customers.createWithGoogle({ name: identity.name, email: identity.email, sub: identity.sub });
        }
      }
      if (customer.deletedAt) throw new GoogleSignInError("removed", "This account has been removed.");
      if (customer.status === "BLOCKED") throw new GoogleSignInError("blocked", "This account can't sign in right now. Please contact the store.", 403);

      const session = await customers.openSession(customer.id, req);
      setCustomerCookie(res, config, session.token, session.maxAgeMs);
      if (wantsJson(req)) return res.json({ customer: customers.view(customer) });
      return back(res, { google: "connected" });
    } catch (e) {
      const err = e instanceof GoogleSignInError ? e
        : e instanceof HttpError ? new GoogleSignInError(e.code === "google_unavailable" ? "unavailable" : e.code === "google_not_configured" ? "not_configured" : "failed", e.message, e.status)
        : null;
      if (!err) throw e; // unexpected: the error handler logs it and answers without details
      if (wantsJson(req)) throw new HttpError(err.status, "google_signin_failed", err.message, { reason: err.reason });
      // a browser always goes back to the storefront's own sign-in page — never to an address from the request
      return back(res, { google: "failed", reason: err.reason });
    }
  });

  return r;
}
