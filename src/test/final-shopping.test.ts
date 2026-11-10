import { afterEach, describe, expect, it } from "vitest";

import { CHECKOUT_DRAFT_KEY, clearCheckoutDraft, loadCheckoutDraft, saveCheckoutDraft } from "@/lib/checkout-draft";
import { emptyCheckout } from "@/lib/checkout-validation";
import { buildApprovalChecklist } from "@/lib/approvals";
import { DEMO_QTY_LIMIT_PER_ITEM, clampQty, qtyLimitText, roomLeft } from "@/lib/pricing";
import { products } from "@/lib/mock-data";

const filled = { ...emptyCheckout, name: "Riya Mehta", phone: "9876543210", email: "riya@example.com", line1: "12 MG Road", city: "Pune", state: "Maharashtra", pincode: "411001" };

describe("demo quantity limit", () => {
  it("caps each item at 10 per order", () => {
    expect(DEMO_QTY_LIMIT_PER_ITEM).toBe(10);
    expect(clampQty(25)).toBe(10);
    expect(roomLeft(7)).toBe(3);
  });
  it("never words the limit as stock left", () => {
    for (const t of [qtyLimitText.full, qtyLimitText.capped(3), qtyLimitText.inBag(10)]) expect(t).not.toMatch(/only|left|stock/i);
  });
});

describe("checkout draft privacy", () => {
  afterEach(() => { sessionStorage.clear(); localStorage.clear(); });
  it("keeps contact details in sessionStorage, never localStorage", () => {
    saveCheckoutDraft(filled, "cod");
    expect(sessionStorage.getItem(CHECKOUT_DRAFT_KEY)).toContain("Riya Mehta");
    expect(localStorage.getItem(CHECKOUT_DRAFT_KEY)).toBeNull();
    expect(loadCheckoutDraft()).toEqual({ form: filled, pay: "cod" });
  });
  it("drops unknown fields such as card numbers", () => {
    sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify({ form: { ...filled, cardNumber: "4111111111111111" }, pay: "cod" }));
    expect(JSON.stringify(loadCheckoutDraft())).not.toContain("4111");
  });
  it("removes old permanent copies", () => {
    localStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify({ form: filled }));
    loadCheckoutDraft();
    expect(localStorage.getItem(CHECKOUT_DRAFT_KEY)).toBeNull();
  });
  it("clears everything when checkout finishes", () => {
    saveCheckoutDraft(filled, "razorpay");
    clearCheckoutDraft();
    expect(sessionStorage.getItem(CHECKOUT_DRAFT_KEY)).toBeNull();
  });
});

describe("client approval checklist", () => {
  const items = buildApprovalChecklist({ products, publicReviewCount: 0 });
  const status = (id: string) => items.find((i) => i.id === id)?.status;
  it("lists all ten required items", () =>
    expect(items.map((i) => i.id)).toEqual(["sizes", "ingredients", "usage", "inventory", "shipping", "cod", "policies", "reviews", "whatsapp", "claims"]));
  it("keeps unconfirmed facts waiting on the client", () => {
    for (const id of ["inventory", "shipping", "cod", "policies", "reviews", "whatsapp", "claims"]) expect(status(id)).toBe("waiting");
  });
  it("marks brand claims confirmed only once the client confirms them", () => {
    const ok = buildApprovalChecklist({ products, publicReviewCount: 0, claimsConfirmed: true });
    expect(ok.find((i) => i.id === "claims")?.status).toBe("confirmed");
  });
  it("turns confirmed only when the fact is supplied", () => {
    const ok = buildApprovalChecklist({ products, publicReviewCount: 0, shippingConfirmed: true, whatsappNumber: "+919737422248" });
    expect(ok.find((i) => i.id === "shipping")?.status).toBe("confirmed");
    expect(ok.find((i) => i.id === "whatsapp")?.status).toBe("confirmed");
  });
});
