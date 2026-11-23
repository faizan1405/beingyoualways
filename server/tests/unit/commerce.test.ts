// Pure unit tests for money, pricing, discount, shipping/COD and Razorpay signature rules.
import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/config.js";
import { placeOrderSchema } from "../../src/lib/checkoutSchema.js";
import { fromPaise, percentOf, toPaise } from "../../src/lib/money.js";
import { canTransition } from "../../src/lib/orderStatus.js";
import { codBlocker, computeTotals, evaluateDiscount, type DiscountRule, type PricedLine } from "../../src/lib/pricing.js";
import { DEFAULT_COD, DEFAULT_SHIPPING, codProblems, inRegion, shippingProblems, type ShippingSettings } from "../../src/lib/settingsSchema.js";
import { hmacHex, safeEqualHex } from "../../src/services/razorpay.js";
import { checkOrderToken, orderToken } from "../../src/services/orderLinks.js";

const line = (o: Partial<PricedLine> = {}): PricedLine => ({ productId: "p1", variantId: "v1", categorySlug: "skincare", productName: "Serum", variantLabel: "30 ml", unitPaise: 68000, quantity: 1, ...o });
const ship: ShippingSettings = { ...DEFAULT_SHIPPING, enabled: true, flatFeePaise: 7900, freeAbovePaise: 99900, estimateMinDays: 3, estimateMaxDays: 6 };
const rule = (o: Partial<DiscountRule> = {}): DiscountRule => ({ code: "X", type: "PERCENT", value: 10, minOrderPaise: null, maxDiscountPaise: null, startsAt: null, endsAt: null, usageLimit: null, usedCount: 0, active: true, productIds: null, categorySlugs: null, ...o });

describe("money is integer paise", () => {
  it("converts database rupees exactly and rounds percentages half-up to the paisa", () => {
    expect(toPaise("695.00")).toBe(69500);
    expect(toPaise("0.1")).toBe(10);
    expect(fromPaise(69501).toString()).toBe("695.01");
    expect(percentOf(68000, 10)).toBe(6800);
    expect(percentOf(29900, 12.5)).toBe(3738); // 3737.5 → 3738
    expect(() => fromPaise(1.5)).toThrow();
  });
});

describe("totals", () => {
  it("charges the flat fee below the free-shipping threshold (after discount) and adds the COD charge", () => {
    expect(computeTotals({ lines: [line()], discountPaise: 0, shipping: ship, codFeePaise: 4900 })).toEqual({ subtotalPaise: 68000, discountPaise: 0, shippingPaise: 7900, codFeePaise: 4900, totalPaise: 80800 });
    expect(computeTotals({ lines: [line({ quantity: 2 })], discountPaise: 0, shipping: ship, codFeePaise: 0 }).shippingPaise).toBe(0);
    expect(computeTotals({ lines: [line({ quantity: 2 })], discountPaise: 40000, shipping: ship, codFeePaise: 0 }).shippingPaise).toBe(7900);
  });
  it("refuses to price shipping that was never configured", () => {
    expect(() => computeTotals({ lines: [line()], discountPaise: 0, shipping: DEFAULT_SHIPPING, codFeePaise: 0 })).toThrow();
    expect(shippingProblems(DEFAULT_SHIPPING).length).toBeGreaterThan(0);
    expect(shippingProblems(ship)).toEqual([]);
    expect(codProblems(DEFAULT_COD).length).toBeGreaterThan(0);
  });
});

describe("discount rules", () => {
  const now = new Date("2026-11-23T10:00:00Z");
  it("percent, cap, fixed and eligible categories", () => {
    expect(evaluateDiscount(rule(), [line()], now)).toEqual({ ok: true, amountPaise: 6800 });
    expect(evaluateDiscount(rule({ maxDiscountPaise: 5000 }), [line()], now)).toEqual({ ok: true, amountPaise: 5000 });
    expect(evaluateDiscount(rule({ type: "FIXED", value: 100000 }), [line()], now)).toEqual({ ok: true, amountPaise: 68000 });
    expect(evaluateDiscount(rule({ categorySlugs: ["haircare"] }), [line(), line({ variantId: "v2", categorySlug: "haircare", unitPaise: 47000 })], now)).toEqual({ ok: true, amountPaise: 4700 });
  });
  it("dates, usage limits, minimum order and inactive codes", () => {
    expect(evaluateDiscount(rule({ active: false }), [line()], now).ok).toBe(false);
    expect(evaluateDiscount(rule({ startsAt: new Date("2026-12-01") }), [line()], now).ok).toBe(false);
    expect(evaluateDiscount(rule({ endsAt: new Date("2026-11-01") }), [line()], now).ok).toBe(false);
    expect(evaluateDiscount(rule({ usageLimit: 5, usedCount: 5 }), [line()], now).ok).toBe(false);
    expect(evaluateDiscount(rule({ minOrderPaise: 100000 }), [line()], now).ok).toBe(false);
  });
});

describe("COD and delivery regions", () => {
  const cod = { enabled: true, feePaise: 4900, minOrderPaise: 50000, maxOrderPaise: 300000, regions: { mode: "pincodes" as const, states: [], pincodePrefixes: ["560", "400001"] } };
  it("checks limits and eligible PIN codes", () => {
    expect(codBlocker(cod, 60000, { state: "Karnataka", pincode: "560034" })).toBeNull();
    expect(codBlocker(cod, 40000, { state: "Karnataka", pincode: "560034" })).toMatch(/₹500/);
    expect(codBlocker(cod, 400000, { state: "Karnataka", pincode: "560034" })).toMatch(/up to/);
    expect(codBlocker(cod, 60000, { state: "Delhi", pincode: "110001" })).toMatch(/PIN/);
    expect(codBlocker({ ...cod, enabled: false }, 60000, undefined)).not.toBeNull();
    expect(inRegion({ mode: "states", states: ["Goa"], pincodePrefixes: [] }, "Goa", "403001")).toBe(true);
    expect(inRegion({ mode: "states", states: ["Goa"], pincodePrefixes: [] }, "Kerala", "682001")).toBe(false);
  });
});

describe("order fulfilment steps", () => {
  it("can't skip steps or reopen closed orders", () => {
    expect(canTransition("NEW", "CONFIRMED")).toBe(true);
    expect(canTransition("NEW", "DELIVERED")).toBe(false);
    expect(canTransition("PENDING_PAYMENT", "NEW")).toBe(false);
    expect(canTransition("CANCELLED", "NEW")).toBe(false);
  });
});

describe("checkout input", () => {
  it("normalises phone numbers and refuses browser-sent prices or totals", () => {
    const base = { checkoutKey: "4f6b3c1e-2d6a-4b8e-9b1a-1c2d3e4f5a6b", lines: [{ productId: "p", variantId: "v", quantity: 1 }], contact: { name: "Asha Rao", email: "ASHA@Example.com", phone: "+91 98450 12345" }, address: { line1: "12 Lake View Road", city: "Mysuru", state: "Karnataka", pincode: "570001" }, paymentMethod: "cod", totalPaise: 1 };
    const p = placeOrderSchema.parse(base);
    expect(p.contact.phone).toBe("9845012345");
    expect(p.contact.email).toBe("asha@example.com");
    expect("totalPaise" in p).toBe(false);
    expect(placeOrderSchema.safeParse({ ...base, address: { ...base.address, line1: "<script>x</script>" } }).success).toBe(false);
  });
});

describe("Razorpay signatures and credentials", () => {
  it("verifies HMAC signatures in constant time and rejects anything else", () => {
    const sig = hmacHex("secret", "order_1|pay_1");
    expect(safeEqualHex(sig, sig)).toBe(true);
    expect(safeEqualHex(sig, hmacHex("other", "order_1|pay_1"))).toBe(false);
    expect(safeEqualHex(sig, undefined)).toBe(false);
    expect(safeEqualHex(sig, "zz")).toBe(false);
  });
  it("keeps test and live keys apart and needs every secret", () => {
    const base = { DATABASE_URL: "mysql://u:p@h:3306/d", LOG_LEVEL: "silent" };
    expect(loadConfig({ ...base, RAZORPAY_KEY_ID: "rzp_test_abc", RAZORPAY_KEY_SECRET: "s", RAZORPAY_WEBHOOK_SECRET: "w" }).razorpay?.mode).toBe("test");
    expect(() => loadConfig({ ...base, RAZORPAY_KEY_ID: "rzp_live_abc", RAZORPAY_KEY_SECRET: "s", RAZORPAY_WEBHOOK_SECRET: "w" })).toThrow(/live Razorpay keys/);
    expect(() => loadConfig({ ...base, RAZORPAY_KEY_ID: "rzp_test_abc", RAZORPAY_KEY_SECRET: "s" })).toThrow(/WEBHOOK_SECRET/);
    expect(() => loadConfig({ ...base, NODE_ENV: "production", CORS_ORIGINS: "https://a.example", RAZORPAY_KEY_ID: "rzp_live_abc", RAZORPAY_KEY_SECRET: "s", RAZORPAY_WEBHOOK_SECRET: "w", ORDER_LINK_SECRET: "x".repeat(32), STORE_TEST_MODE: "true" })).toThrow(/STORE_TEST_MODE/);
    expect(loadConfig(base).razorpay).toBeNull();
  });
  it("order links can't be guessed or reused for another order", () => {
    const t = orderToken("k".repeat(32), "BYA-261123-AAAAA");
    expect(checkOrderToken("k".repeat(32), "BYA-261123-AAAAA", t)).toBe(true);
    expect(checkOrderToken("k".repeat(32), "BYA-261123-AAAAB", t)).toBe(false);
  });
});
