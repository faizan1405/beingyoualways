import { describe, expect, it } from "vitest";
import { heroProgress, transformAmount } from "@/components/home/Hero";
import { policies, policyReview } from "@/content/policies";

describe("hero skin transformation", () => {
  it("starts fully on the Before photo at the top", () => expect(transformAmount(heroProgress(0, 1360, 800))).toBe(0));
  it("shows the fully clear face at 80% while still pinned", () => expect(transformAmount(0.8)).toBe(1));
  it("holds the clear face until the hero releases", () => expect(transformAmount(heroProgress(-560, 1360, 800))).toBe(1));
  it("reverses when scrolling back up", () => expect(transformAmount(0.3)).toBeLessThan(transformAmount(0.6)));
});

describe("policies", () => {
  it("keeps the source legal entity unchanged in Terms", () => expect(policies.terms.html).toContain("SHOP MITRA E TRADING PRIVATE LIMITED"));
  it("is never marked legally approved by migration alone", () => {
    for (const r of Object.values(policyReview)) expect(r.legallyApproved).toBe(false);
  });
});
