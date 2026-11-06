import { describe, expect, it } from "vitest";

import { validateCheckout } from "@/lib/checkout-validation";
import { shippingFor } from "@/services/cartService";
import { filterProducts } from "@/services/productService";
import { products } from "@/lib/mock-data";

const ok = { name: "Riya Mehta", phone: "9876543210", email: "riya@example.com", address: "12 MG Road", city: "Pune", state: "Maharashtra", pincode: "411001" };

describe("shop rules", () => {
  it("ships free at ₹999 and above", () => expect(shippingFor(999)).toBe(0));
  it("charges ₹79 below ₹999", () => expect(shippingFor(998)).toBe(79));
  it("accepts a valid checkout", () => expect(validateCheckout(ok)).toEqual({}));
  it("rejects a 5-digit PIN code", () => expect(validateCheckout({ ...ok, pincode: "41100" }).pincode).toBeTruthy());
  it("rejects a mobile not starting 6-9", () => expect(validateCheckout({ ...ok, phone: "5876543210" }).phone).toBeTruthy());
  it("filters by category", () => expect(filterProducts(products, { category: "haircare" }).every((p) => p.category === "haircare")).toBe(true));
  it("sorts by price ascending", () => {
    const l = filterProducts(products, { sort: "price-asc" });
    expect(l[0]!.variants[0]!.price).toBeLessThanOrEqual(l[l.length - 1]!.variants[0]!.price);
  });
});
