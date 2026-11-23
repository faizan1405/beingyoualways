import { Router } from "express";
import { z } from "zod";

import type { Config } from "../config.js";
import { forbidden, HttpError } from "../errors.js";
import { clearCustomerCookie, customerCookieOptions, setCustomerCookie } from "../middleware/customerAuth.js";
import { loginLimiter } from "../middleware/security.js";
import type { CustomerAuthService } from "../services/customerAuthService.js";
import type { GoogleAuth, GoogleState } from "../services/googleAuth.js";

const callbackSchema = z.object({
  code: z.string().trim().max(2048).optional(),
  state: z.string().trim().max(256).optional(),
  error: z.string().trim().max(120).optional(),
});

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
    res.cookie(google.stateCookie, JSON.stringify({ state: flow.state, nonce: flow.nonce, verifier: flow.verifier } satisfies GoogleState), {
      ...customerCookieOptions(config, flow.maxAgeMs),
      httpOnly: true,
    });
    if (wantsJson(req)) return res.json({ url: flow.url });
    return res.redirect(302, flow.url);
  });

  r.get("/callback", limit, async (req, res) => {
    const raw = (req.cookies as Record<string, string | undefined> | undefined)?.[google.stateCookie];
    clearCustomerCookie(res, config);
    res.clearCookie(google.stateCookie, customerCookieOptions(config));

    let stored: GoogleState | null = null;
    try {
      stored = raw ? (JSON.parse(raw) as GoogleState) : null;
    } catch {
      stored = null;
    }
    const q = callbackSchema.parse(req.query);

    const fail = (message: string): never => {
      if (wantsJson(req)) throw new HttpError(400, "google_signin_failed", message);
      back(res, { google: "failed" });
      throw new HttpError(400, "google_signin_failed", message);
    };

    if (q.error) return fail("Google cancelled the sign-in.");
    if (!stored || !q.state || stored.state !== q.state) return fail("That sign-in has expired. Please try again.");
    if (!q.code) return fail("Google didn't finish the sign-in. Please try again.");

    const identity = await google.complete(q.code, stored);

    let customer = await customers.findByGoogleSub(identity.sub);
    if (!customer) {
      const byEmail = await customers.findByEmail(identity.email);
      if (byEmail) {
        // Takeover guard: a password account whose address we never confirmed stays password-only
        // until somebody proves the password and connects Google from inside the account.
        if (byEmail.passwordHash && !byEmail.emailVerifiedAt) {
          return fail("An account with this email was opened with a password. Sign in with that password first, then connect Google from your account.");
        }
        customer = await customers.linkGoogleSub(byEmail.id, identity.sub);
      } else {
        customer = await customers.createWithGoogle({ name: identity.name, email: identity.email, sub: identity.sub });
      }
    }
    if (customer.deletedAt) return fail("This account has been removed.");
    if (customer.status === "BLOCKED") {
      if (wantsJson(req)) throw forbidden("This account can't sign in right now. Please contact the store.");
      return fail("This account can't sign in right now. Please contact the store.");
    }

    const session = await customers.openSession(customer.id, req);
    setCustomerCookie(res, config, session.token, session.maxAgeMs);
    if (wantsJson(req)) return res.json({ customer: customers.view(customer) });
    return back(res, { google: "connected" });
  });

  return r;
}
