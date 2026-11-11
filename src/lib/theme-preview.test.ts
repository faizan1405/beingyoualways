import { describe, expect, it } from "vitest";
import { APPROVED_THEME, THEME_CHOICE_CONFIRMED, resolveTheme } from "./theme-preview";

describe("theme preview", () => {
  it("shows every shopper the client-approved Clean White theme by default", () => {
    expect(APPROVED_THEME).toBe("white");
    expect(THEME_CHOICE_CONFIRMED).toBe(true);
    expect(resolveTheme(null, null)).toEqual({ theme: "white", previewing: false, store: null });
  });
  it("shows the old Ivory only when a preview is requested, and remembers it", () => {
    expect(resolveTheme("ivory", null)).toEqual({ theme: "ivory", previewing: true, store: "ivory" });
    expect(resolveTheme(null, "ivory").theme).toBe("ivory");
  });
  it("ending the preview returns to Clean White", () => {
    expect(resolveTheme("off", "ivory")).toEqual({ theme: "white", previewing: false, store: null });
  });
  it("ignores unknown theme names", () => expect(resolveTheme("purple", "neon").theme).toBe("white"));
});
