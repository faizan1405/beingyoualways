import { describe, expect, it } from "vitest";
import { testimonialService } from "./testimonialService";

const base = { id: "t1", category: "Skin" as const, name: "A", city: "B", quote: "Q", verified: true, consent: true, published: true };

describe("testimonials", () => {
  it("hides a review that is not verified", () => {
    testimonialService.save({ ...base, id: "x1", verified: false });
    expect(testimonialService.publicList().some((t) => t.id === "x1")).toBe(false);
  });
  it("hides a review without customer consent", () => {
    testimonialService.save({ ...base, id: "x2", consent: false });
    expect(testimonialService.publicList().some((t) => t.id === "x2")).toBe(false);
  });
  it("shows a verified, consented, published review", () => {
    testimonialService.save({ ...base, id: "x3" });
    expect(testimonialService.publicList().some((t) => t.id === "x3")).toBe(true);
  });
});
