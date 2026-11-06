import { describe, expect, it } from "vitest";
import { transformAmount } from "@/components/home/Hero";
import { policies, policyReview } from "@/content/policies";

describe("hero skin transformation", () => {
  it("starts fully on the Before photo", () => expect(transformAmount(0)).toBe(0));
  it("ends fully on the After photo", () => expect(transformAmount(1)).toBe(1));
  it("is halfway at mid-scroll and reverses with scroll", () => {
    expect(transformAmount(0.48)).toBeCloseTo(0.5, 2);
    expect(transformAmount(0.3)).toBeLessThan(transformAmount(0.6));
  });
});

describe("policies", () => {
  it("keeps the source legal entity unchanged in Terms", () => expect(policies.terms.html).toContain("SHOP MITRA E TRADING PRIVATE LIMITED"));
  it("is never marked legally approved by migration alone", () => {
    for (const r of Object.values(policyReview)) expect(r.legallyApproved).toBe(false);
  });
});
