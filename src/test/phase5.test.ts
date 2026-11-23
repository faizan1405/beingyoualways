import { afterEach, describe, expect, it, vi } from "vitest";

describe("demo sign-in codes never exist on the real website", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); sessionStorage.clear(); });
  it("a production build without the store server refuses to send or accept a WhatsApp code", { timeout: 20_000 }, async () => {
    vi.resetModules();
    vi.stubEnv("DEV", false);
    vi.stubEnv("PROD", true);
    const { authService, isDemoSignIn } = await import("@/services/authService");
    expect(isDemoSignIn()).toBe(false);
    const sent = await authService.requestOtp("9876543210");
    expect(sent.ok).toBe(false);
    const checked = await authService.verifyOtp("9876543210", "123456");
    expect(checked.ok).toBe(false);
  });
});

describe("bag-page reminder flag", () => {
  afterEach(() => { sessionStorage.clear(); localStorage.clear(); });
  it("is off by default, holds no personal data and is cleared when a new checkout starts", async () => {
    const d = await import("@/lib/checkout-draft");
    expect(d.bagReminderOn()).toBe(false);
    d.setBagReminderOn(true);
    expect(d.bagReminderOn()).toBe(true);
    expect(sessionStorage.getItem("bya.bag.reminder.v1")).toBe("1");
    expect(localStorage.length).toBe(0);
    d.resetCheckoutKey();
    expect(d.bagReminderOn()).toBe(false);
  });
});
