import { describe, expect, it } from "vitest";

import { parseSiteEnv, ROBOTS_TXT } from "./site-env";
import { markStagingResponse, stagingGate } from "./staging-gate";

const PASSWORD = "neem-saffron-staging-42";
const req = (path: string, auth?: string) =>
  new Request(
    `https://staging.beingyoualways.com${path}`,
    auth ? { headers: { authorization: auth } } : {},
  );
const basic = (user: string, pass: string) => `Basic ${btoa(`${user}:${pass}`)}`;

describe("staging website lock", () => {
  it("never touches the real store", () => {
    expect(stagingGate(req("/"), "production", undefined)).toBeNull();
    expect(parseSiteEnv(undefined)).toBe("production");
    expect(parseSiteEnv("Staging")).toBe("staging");
  });
  it("asks for the password and lets the right one through", () => {
    const r = stagingGate(req("/shop"), "staging", PASSWORD);
    expect(r?.status).toBe(401);
    expect(r?.headers.get("www-authenticate")).toMatch(/^Basic realm=/);
    expect(
      stagingGate(req("/shop", basic("team", "wrong-password-123")), "staging", PASSWORD)?.status,
    ).toBe(401);
    expect(stagingGate(req("/shop", basic("team", PASSWORD)), "staging", PASSWORD)).toBeNull();
  });
  it("stays locked when no password (or a short one) is set on the server", () => {
    expect(stagingGate(req("/", basic("x", "")), "staging", undefined)?.status).toBe(503);
    expect(stagingGate(req("/", basic("x", "short")), "staging", "short")?.status).toBe(503);
  });
  it("tells crawlers to stay out, without needing the password", async () => {
    const r = stagingGate(req("/robots.txt"), "staging", PASSWORD);
    expect(r?.status).toBe(200);
    expect(await r?.text()).toBe("User-agent: *\nDisallow: /\n");
    expect(markStagingResponse(new Response("ok"), "staging").headers.get("x-robots-tag")).toMatch(
      /noindex/,
    );
    expect(
      markStagingResponse(new Response("ok"), "production").headers.get("x-robots-tag"),
    ).toBeNull();
  });
  it("keeps the real store's robots.txt open to search engines", () => {
    expect(ROBOTS_TXT.production).toContain("User-agent: *\nAllow: /");
  });
});
