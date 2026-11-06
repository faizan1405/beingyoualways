// DEMO ONLY — no real authentication. Live WhatsApp OTP and Google sign-in will be
// enabled once the Hostinger backend issues sessions. Never treat this as secure.

export type AuthProvider = "whatsapp" | "google";

export interface AuthSession {
  userId: string;
  provider: AuthProvider;
  name?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
}

export type GoogleSignInResult =
  | { ok: true; session: AuthSession }
  | { ok: false; reason: "integration-required" };

/** Set once the Hostinger backend exposes an OAuth start URL (e.g. /api/auth/google). */
export const GOOGLE_OAUTH_START_URL: string | null = null;

export const authService = {
  requestOtp: async (_phone: string) => ({ ok: true as const, demo: true }),
  verifyOtp: async (_phone: string, code: string) => ({ ok: code.length === 6, demo: true }),
  /** Redirects to the backend OAuth flow when configured; otherwise reports that integration is required. Never fakes a session. */
  signInWithGoogle: async (): Promise<GoogleSignInResult> => {
    if (GOOGLE_OAUTH_START_URL && typeof window !== "undefined") {
      window.location.assign(GOOGLE_OAUTH_START_URL);
    }
    return { ok: false, reason: "integration-required" };
  },
};
