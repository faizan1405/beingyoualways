// DEMO ONLY — no real authentication. Live WhatsApp OTP will be enabled once
// the Hostinger backend issues and verifies codes. Never treat this as secure.
export const authService = {
  requestOtp: async (_phone: string) => ({ ok: true as const, demo: true }),
  verifyOtp: async (_phone: string, code: string) => ({ ok: code.length === 6, demo: true }),
};
