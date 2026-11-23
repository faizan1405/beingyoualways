// Password lock for the staging website (runs in src/server.ts before any page renders).
// Only active in a VITE_SITE_ENV=staging build. The password comes from the STAGING_ACCESS_PASSWORD
// environment variable on the Hostinger app — never from the code. Without it staging stays locked.
import { ROBOTS_TXT, type SiteEnv } from "./site-env";

export const STAGING_REALM = "Being You staging";
const NOINDEX = "noindex, nofollow, noarchive";

/** Same-time comparison so the password can't be guessed from response timing. */
function sameText(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a),
    eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

function passwordFrom(header: string | null): string | null {
  const m = /^Basic\s+([A-Za-z0-9+/=]+)$/i.exec(header?.trim() ?? "");
  if (!m?.[1]) return null;
  try {
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0)));
    const at = decoded.indexOf(":");
    return at >= 0 ? decoded.slice(at + 1) : null;
  } catch {
    return null;
  }
}

const text = (body: string, status: number, extra: Record<string, string> = {}) =>
  new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": NOINDEX,
      ...extra,
    },
  });

/**
 * Returns a response that stops the request (robots.txt, password prompt, locked notice), or null to
 * let the page render. Production builds always return null.
 */
export function stagingGate(
  request: Request,
  siteEnv: SiteEnv,
  password: string | undefined,
): Response | null {
  if (siteEnv !== "staging") return null;
  const url = new URL(request.url);
  // crawlers must be able to read "stay out" without the password
  if (url.pathname === "/robots.txt") return text(ROBOTS_TXT.staging, 200);
  const expected = password?.trim() ?? "";
  if (expected.length < 12)
    return text(
      "This staging site is locked: STAGING_ACCESS_PASSWORD (12+ characters) isn't set on the server.",
      503,
    );
  const given = passwordFrom(request.headers.get("authorization"));
  if (given !== null && sameText(given, expected)) return null;
  return text("This is a private test copy of the store.", 401, {
    "www-authenticate": `Basic realm="${STAGING_REALM}", charset="UTF-8"`,
  });
}

/** Every staging response is marked noindex, whatever the page says. */
export function markStagingResponse(response: Response, siteEnv: SiteEnv): Response {
  if (siteEnv !== "staging") return response;
  const headers = new Headers(response.headers);
  headers.set("x-robots-tag", NOINDEX);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
