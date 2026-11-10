import { describe, expect, it } from "vitest";

import { emptyCheckout, firstInvalidStep, validateAddress, validateCheckout, validateContact, validatePayment } from "@/lib/checkout-validation";
import { sampleShippingFor, shippingFor } from "@/services/cartService";
import { filterProducts } from "@/services/productService";
import { products } from "@/lib/mock-data";

const ok = { ...emptyCheckout, name: "Riya Mehta", phone: "9876543210", email: "riya@example.com", line1: "12 MG Road", city: "Pune", state: "Maharashtra", pincode: "411001" };

describe("shop rules", () => {
  it("charges no shipping while rates are unconfirmed", () => expect(shippingFor(500)).toBe(0));
  it("sample rate: free at ₹999 and above", () => expect(sampleShippingFor(999)).toBe(0));
  it("sample rate: ₹79 below ₹999", () => expect(sampleShippingFor(998)).toBe(79));
  it("accepts a valid checkout", () => expect(validateCheckout(ok, "cod")).toEqual({}));
  it("rejects a 5-digit PIN code", () => expect(validateAddress({ ...ok, pincode: "41100" }).pincode).toBeTruthy());
  it("rejects a PIN code starting with 0", () => expect(validateAddress({ ...ok, pincode: "011001" }).pincode).toBeTruthy());
  it("rejects a mobile not starting 6-9", () => expect(validateContact({ ...ok, phone: "5876543210" }).phone).toBeTruthy());
  it("accepts a mobile typed with +91", () => expect(validateContact({ ...ok, phone: "+91 98765 43210" }).phone).toBeUndefined());
  it("rejects an email without a domain", () => expect(validateContact({ ...ok, email: "riya@example" }).email).toBeTruthy());
  it("requires every contact and address field", () => {
    const e = validateCheckout(emptyCheckout, "razorpay");
    expect(Object.keys(e).sort()).toEqual(["city", "email", "line1", "name", "phone", "pincode", "state"]);
  });
  it("requires a payment method", () => expect(validatePayment(null).payment).toBeTruthy());
  it("sends the shopper back to the first step with an error", () => {
    expect(firstInvalidStep({ ...ok, pincode: "" }, "cod")).toBe("address");
    expect(firstInvalidStep(ok, null)).toBe("payment");
    expect(firstInvalidStep(ok, "cod")).toBeNull();
  });
  it("filters by category", () => expect(filterProducts(products, { category: "haircare" }).every((p) => p.category === "haircare")).toBe(true));
  it("sorts by price ascending", () => {
    const l = filterProducts(products, { sort: "price-asc" });
    expect(l[0]!.variants[0]!.price).toBeLessThanOrEqual(l[l.length - 1]!.variants[0]!.price);
  });
});
