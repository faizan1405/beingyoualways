import { createHash, createPublicKey, randomBytes, verify } from "node:crypto";

import type { Config } from "../config.js";
import { badRequest, HttpError } from "../errors.js";
import type { Logger } from "../logger.js";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const STATE_TTL_MS = 10 * 60_000;

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

export interface GoogleFlow {
  url: string;
  state: string;
  nonce: string;
  verifier: string;
  maxAgeMs: number;
}

/** What the browser holds between "start" and "callback" — nothing secret about the account itself. */
export interface GoogleState {
  state: string;
  nonce: string;
  verifier: string;
}

interface Jwk {
  kid?: string;
  kty?: string;
  n?: string;
  e?: string;
}

/**
 * Sign-in with Google (authorization code + PKCE). The ID token is verified here against Google's own
 * signing keys — iss, aud, exp and nonce must all match before any account is touched. If the
 * credentials aren't configured the flow stays off: the site is told plainly, never shown a fake button.
 */
export function createGoogleAuth(config: Config, logger: Logger) {
  let jwks: { at: number; keys: Jwk[] } | null = null;

  async function signingKeys(): Promise<Jwk[]> {
    if (jwks && Date.now() - jwks.at < 10 * 60_000) return jwks.keys;
    const res = await fetch(JWKS_URL, { headers: { accept: "application/json" } });
    if (!res.ok) throw new HttpError(502, "google_unavailable", "Google couldn't be reached. Please try again.");
    const body = (await res.json()) as { keys?: Jwk[] };
    jwks = { at: Date.now(), keys: Array.isArray(body.keys) ? body.keys : [] };
    return jwks.keys;
  }

  function start(): GoogleFlow {
    if (!config.google) throw new HttpError(503, "google_not_configured", "Sign-in with Google isn't set up on this store yet.");
    const state = randomBytes(24).toString("base64url");
    const nonce = randomBytes(24).toString("base64url");
    const verifier = randomBytes(48).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const url = new URL(AUTH_URL);
    url.searchParams.set("client_id", config.google.clientId);
    url.searchParams.set("redirect_uri", config.google.redirectUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("prompt", "select_account");
    return { url: url.toString(), state, nonce, verifier, maxAgeMs: STATE_TTL_MS };
  }

  /** Verifies the ID token Google handed back. Anything short of a clean verification is refused. */
  async function verifyIdToken(idToken: string, nonce: string): Promise<GoogleIdentity> {
    const g = config.google;
    if (!g) throw new HttpError(503, "google_not_configured", "Sign-in with Google isn't set up on this store yet.");
    const parts = idToken.split(".");
    if (parts.length !== 3) throw badRequest("Google's response was incomplete. Please try again.");
    const [h, p, s] = parts as [string, string, string];
    const header = JSON.parse(Buffer.from(h, "base64url").toString("utf8")) as { alg?: string; kid?: string };
    if (header.alg !== "RS256") throw badRequest("Google's response used an unexpected signature method.");

    const keys = await signingKeys();
    const jwk = keys.find((k) => k.kid === header.kid && k.kty === "RSA" && k.n && k.e);
    if (!jwk) throw badRequest("Google's response couldn't be verified. Please try again.");

    const publicKey = createPublicKey({ key: { kty: "RSA", n: jwk.n!, e: jwk.e! }, format: "jwk" });
    const signatureOk = verify("RSA-SHA256", Buffer.from(`${h}.${p}`, "utf8"), publicKey, Buffer.from(s, "base64url"));
    if (!signatureOk) throw badRequest("Google's response didn't pass verification. Please try again.");

    const claims = JSON.parse(Buffer.from(p, "base64url").toString("utf8")) as {
      iss?: string; aud?: string; exp?: number; nonce?: string; sub?: string; email?: string; email_verified?: boolean; name?: string;
    };
    if (!claims.iss || !ISSUERS.has(claims.iss)) throw badRequest("That response didn't come from Google.");
    if (claims.aud !== g.clientId) throw badRequest("That response wasn't meant for this store.");
    if (!claims.exp || claims.exp * 1000 < Date.now()) throw badRequest("That sign-in link has expired. Please try again.");
    if (claims.nonce !== nonce) throw badRequest("That sign-in has already been used. Please try again.");
    if (!claims.sub) throw badRequest("Google didn't identify this account.");
    // Only an address Google itself has confirmed may open or link an account.
    if (!claims.email || claims.email_verified !== true) {
      throw badRequest("Google hasn't confirmed this email address, so it can't be used to sign in here.");
    }
    return {
      sub: String(claims.sub),
      email: String(claims.email).toLowerCase(),
      emailVerified: true,
      name: (claims.name && String(claims.name).trim().slice(0, 120)) || String(claims.email),
    };
  }

  async function complete(code: string, state: GoogleState): Promise<GoogleIdentity> {
    const g = config.google;
    if (!g) throw new HttpError(503, "google_not_configured", "Sign-in with Google isn't set up on this store yet.");
    if (!code) throw badRequest("Google didn't finish the sign-in. Please try again.");
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: g.clientId,
        client_secret: g.clientSecret,
        redirect_uri: g.redirectUrl,
        grant_type: "authorization_code",
        code_verifier: state.verifier,
      }),
    });
    if (!res.ok) {
      logger.warn("google token exchange rejected", { status: res.status });
      throw badRequest("Google didn't accept the sign-in. Please try again.");
    }
    const body = (await res.json()) as { id_token?: string };
    if (!body.id_token) throw badRequest("Google didn't return an account. Please try again.");
    return verifyIdToken(body.id_token, state.nonce);
  }

  return {
    configured: Boolean(config.google),
    start,
    complete,
    stateCookie: "bya_google_flow",
  };
}

export type GoogleAuth = ReturnType<typeof createGoogleAuth>;
