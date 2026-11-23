// Which copy of the website this build is. Set VITE_SITE_ENV=staging on the Hostinger staging app
// (build-time); anything else is the real store. Read by the staging strip, robots rules and the gate.
export type SiteEnv = "production" | "staging";

export const parseSiteEnv = (raw: string | undefined): SiteEnv =>
  raw?.trim().toLowerCase() === "staging" ? "staging" : "production";

export const SITE_ENV: SiteEnv = parseSiteEnv(
  import.meta.env["VITE_SITE_ENV"] as string | undefined,
);
export const IS_STAGING = SITE_ENV === "staging";

export const ROBOTS_TXT = {
  production: [
    "User-agent: Googlebot",
    "Allow: /",
    "",
    "User-agent: Bingbot",
    "Allow: /",
    "",
    "User-agent: Twitterbot",
    "Allow: /",
    "",
    "User-agent: facebookexternalhit",
    "Allow: /",
    "",
    "User-agent: *",
    "Allow: /",
    "",
  ].join("\n"),
  staging: "User-agent: *\nDisallow: /\n",
} as const;
