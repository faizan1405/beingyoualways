import { describe, expect, it } from "vitest";
import { APPROVED_THEME, resolveTheme } from "./theme-preview";

describe("theme preview", () => {
  it("keeps the existing Ivory theme as the public default", () => {
    expect(APPROVED_THEME).toBe("ivory");
    expect(resolveTheme(null, null)).toEqual({ theme: "ivory", previewing: false, store: null });
  });
  it("shows Pure White only when a preview is requested, and remembers it", () => {
    expect(resolveTheme("white", null)).toEqual({ theme: "white", previewing: true, store: "white" });
    expect(resolveTheme(null, "white").theme).toBe("white");
  });
  it("can switch back to Ivory or end the preview", () => {
    expect(resolveTheme("ivory", "white").theme).toBe("ivory");
    expect(resolveTheme("off", "white")).toEqual({ theme: "ivory", previewing: false, store: null });
  });
  it("ignores unknown theme names", () => expect(resolveTheme("purple", "neon").theme).toBe("ivory"));
});
