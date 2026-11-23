// Account email templates: links reach the shopper intact and shopper-typed names can't inject HTML.
import { describe, expect, it } from "vitest";

import {
  accountDeletedTemplate,
  passwordChangedTemplate,
  passwordResetTemplate,
  verifyEmailTemplate,
} from "../../src/services/emailTemplates.js";

const LINK = "https://beingyoualways.com/verify-email?token=abc_DEF-123";

describe("account email templates", () => {
  it("puts the confirmation link and its 24-hour expiry in both text and HTML", () => {
    const m = verifyEmailTemplate({ name: "Asha", link: LINK, hours: 24 });
    expect(m.subject).toBe("Confirm your email — Being You – Always");
    expect(m.text).toContain(LINK);
    expect(m.text).toContain("24 hours");
    expect(m.html).toContain(`href="${LINK}"`);
  });

  it("states that a reset link works once and expires in the given minutes", () => {
    const m = passwordResetTemplate({ name: "Asha", link: "https://x.test/reset-password?token=t", minutes: 30 });
    expect(m.text).toContain("works once and expires in 30 minutes");
  });

  it("escapes a shopper's name so it can't add markup to the HTML email", () => {
    const m = verifyEmailTemplate({ name: '<img src=x onerror="a()">', link: LINK, hours: 24 });
    expect(m.html).not.toContain("<img");
    expect(m.html).toContain("&lt;img src=x onerror=&quot;a()&quot;&gt;");
  });

  it("tells the shopper other devices were signed out after a password change", () => {
    const changed = passwordChangedTemplate({ name: "Asha", signInUrl: "https://x.test/login", how: "changed" });
    expect(changed.subject).toBe("Your password was changed — Being You – Always");
    expect(changed.text).toContain("signed out");
    const reset = passwordChangedTemplate({ name: null, signInUrl: "https://x.test/login", how: "reset" });
    expect(reset.subject).toBe("Your password was reset — Being You – Always");
    expect(reset.text.startsWith("Hi,")).toBe(true);
  });

  it("confirms deletion and that order records are kept", () => {
    const m = accountDeletedTemplate({ name: "Asha" });
    expect(m.text).toContain("Records of orders you placed are kept");
  });
});
