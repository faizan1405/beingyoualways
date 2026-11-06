import { describe, expect, it } from "vitest";
import { transformAmount } from "@/components/home/Hero";
import { policies, policyReview } from "@/content/policies";

describe("hero skin transformation", () => {
  it("starts fully on the Before photo at the top", () => expect(transformAmount(0, 800)).toBe(0));
  it("is complete after 55% of one viewport of scrolling", () => expect(transformAmount(440, 800)).toBe(1));
  it("reverses when scrolling back up", () => expect(transformAmount(100, 800)).toBeLessThan(transformAmount(300, 800)));
});

describe("policies", () => {
  it("keeps the source legal entity unchanged in Terms", () => expect(policies.terms.html).toContain("SHOP MITRA E TRADING PRIVATE LIMITED"));
  it("is never marked legally approved by migration alone", () => {
    for (const r of Object.values(policyReview)) expect(r.legallyApproved).toBe(false);
  });
});
