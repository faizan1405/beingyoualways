import argon2 from "argon2";

// Argon2id with OWASP-recommended minimums (19 MiB memory, 2 iterations).
const OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (plain: string) => argon2.hash(plain, OPTIONS);

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export const needsRehash = (hash: string) => argon2.needsRehash(hash, OPTIONS);

/** Used when the email is unknown, so a wrong email takes as long as a wrong password. */
let dummy: Promise<string> | null = null;
export const dummyHash = () => (dummy ??= hashPassword("not-a-real-password-" + Math.random()));

const COMMON = ["password", "123456", "qwerty", "beingyou", "beingyoualways", "admin", "welcome", "letmein"];

/**
 * Password policy. Returns a reason when the password is not acceptable.
 * Staff accounts ask for 12 characters, shoppers for 10 — the checks themselves are the same.
 */
export function passwordProblem(pw: string, email?: string, minLength = 12): string | null {
  if (pw.length < minLength) return `Use at least ${minLength} characters.`;
  if (pw.length > 200) return "Use at most 200 characters.";
  if (/^(.)\1+$/.test(pw)) return "Don't repeat a single character.";
  const lower = pw.toLowerCase();
  if (COMMON.some((c) => lower.includes(c) && lower.replace(/[^a-z]/g, "").length <= c.length + 3)) return "That password is too easy to guess.";
  if (email && lower.includes(email.toLowerCase().split("@")[0] ?? "\u0000")) return "Don't include your email name in the password.";
  return null;
}
