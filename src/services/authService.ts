// Sign-in. Live WhatsApp OTP and Google sign-in run on the Hostinger backend, which
// creates the code, sends it with the approved "login_otp" template, checks it and sets
// an httpOnly session cookie. Until that backend is configured this file runs a clearly
// labelled DEMO that never sends a code — and the demo switches itself off as soon as
// HOSTINGER_API_BASE_URL is set, so fake six-digit sign-in can't reach production.
import { API_ENDPOINTS, DEMO_MODE, apiRequest, isBackendConfigured } from "./api";
import { OTP_POLICY, canRequestOtp, canVerifyOtp, emptyOtpState, otpMessage, recordFailedAttempt, recordOtpSent, type OtpState } from "@/lib/whatsapp-cloud";

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

export type OtpRequestResult = { ok: true; demo: boolean; resendInSeconds: number; expiresInSeconds: number } | { ok: false; error: string };
export type OtpVerifyResult = { ok: true; demo: boolean } | { ok: false; error: string; attemptsLeft?: number | undefined };

/** Set once the Hostinger backend exposes an OAuth start URL (e.g. /api/auth/google). */
export const GOOGLE_OAUTH_START_URL: string | null = null;

/** Demo sign-in only exists while there is no backend. */
export const isDemoSignIn = () => DEMO_MODE;
const SIGNIN_OFF = "WhatsApp sign-in isn't available yet — the store server isn't connected.";

// Client-side copy of the limits (the server enforces the real ones). This tab only.
const KEY = "bya.otp";
const readAll = (): Record<string, OtpState> => {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.sessionStorage.getItem(KEY) ?? "{}") as Record<string, OtpState>; } catch { return {}; }
};
const save = (phone: string, s: OtpState) => {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.setItem(KEY, JSON.stringify({ ...readAll(), [phone]: s })); } catch { /* storage unavailable */ }
};
export const otpStateFor = (phone: string): OtpState => readAll()[phone] ?? emptyOtpState();

export const authService = {
  requestOtp: async (phone: string, now = new Date()): Promise<OtpRequestResult> => {
    const st = otpStateFor(phone);
    const check = canRequestOtp(st, now);
    if (!check.ok) return { ok: false, error: otpMessage(check) };
    if (isBackendConfigured()) {
      try {
        const r = await apiRequest<{ expiresInSeconds: number; resendInSeconds: number }>(API_ENDPOINTS.otpRequest, { method: "POST", body: { phone } });
        save(phone, recordOtpSent(st, now));
        return { ok: true, demo: false, ...r };
      } catch (e) { return { ok: false, error: (e as Error).message }; }
    }
    if (!DEMO_MODE) return { ok: false, error: SIGNIN_OFF };
    save(phone, recordOtpSent(st, now));
    return { ok: true, demo: true, resendInSeconds: OTP_POLICY.resendCooldownSeconds, expiresInSeconds: OTP_POLICY.expirySeconds };
  },
  verifyOtp: async (phone: string, code: string, now = new Date()): Promise<OtpVerifyResult> => {
    if (!new RegExp(`^\\d{${OTP_POLICY.codeLength}}$`).test(code)) return { ok: false, error: `Enter all ${OTP_POLICY.codeLength} digits.` };
    const st = otpStateFor(phone);
    const check = canVerifyOtp(st, now);
    if (!check.ok) return { ok: false, error: otpMessage(check) };
    if (isBackendConfigured()) {
      try {
        await apiRequest(API_ENDPOINTS.otpVerify, { method: "POST", body: { phone, code } });
        save(phone, emptyOtpState());
        return { ok: true, demo: false };
      } catch (e) {
        const next = recordFailedAttempt(st, now);
        save(phone, next);
        const left = Math.max(0, OTP_POLICY.maxAttempts - next.failedAttempts);
        return { ok: false, error: left ? `${(e as Error).message} ${left} attempt${left === 1 ? "" : "s"} left.` : otpMessage(canVerifyOtp(next, now)), attemptsLeft: left };
      }
    }
    if (!DEMO_MODE) return { ok: false, error: SIGNIN_OFF };
    save(phone, emptyOtpState());
    return { ok: true, demo: true };
  },
  /** Redirects to the backend OAuth flow when configured; otherwise reports that integration is required. Never fakes a session. */
  signInWithGoogle: async (): Promise<GoogleSignInResult> => {
    if (GOOGLE_OAUTH_START_URL && typeof window !== "undefined") {
      window.location.assign(GOOGLE_OAUTH_START_URL);
    }
    return { ok: false, reason: "integration-required" };
  },
};
