// Rules for the live shop checkout (server amounts, private order links, checkout key).
import { currentCheckoutKey, resetCheckoutKey } from "@/lib/checkout-draft";
import { inrPaise } from "@/lib/format";
import { orderHash, recalledOrderToken, rememberOrderLink, tokenFromHash } from "@/lib/order-links";
import { summaryFromServer } from "@/services/shopService";

describe("server totals on screen", () => {
  it("shows the server's paise amounts exactly, including the COD charge and free shipping", () => {
    const s = summaryFromServer({ subtotalPaise: 136000, discountPaise: 3750, shippingPaise: 0, codFeePaise: 4900, totalPaise: 137150 }, 2);
    expect(s).toEqual({ subtotal: 1360, discount: 37.5, shipping: { state: "free" }, total: 1371.5, itemCount: 2, codFee: 49 });
    expect(summaryFromServer({ subtotalPaise: 68000, discountPaise: 0, shippingPaise: 7900, codFeePaise: 0, totalPaise: 75900 }, 1).shipping).toEqual({ state: "charged", amount: 79 });
    expect(inrPaise(137150)).toBe("₹1,371.50");
    expect(inrPaise(75900)).toBe("₹759");
  });
});

describe("private order links", () => {
  it("reads the token from the address after # and remembers it for this tab only", () => {
    const token = "nMtM1o60is0g5d5uLMgI-fLKvGFdeWe_kRx-OW24MaM";
    expect(tokenFromHash(`#${orderHash(token)}`)).toBe(token);
    expect(tokenFromHash("#t=short")).toBeNull();
    rememberOrderLink("BYA-261123-ABCDE", token);
    expect(recalledOrderToken("BYA-261123-ABCDE")).toBe(token);
    expect(localStorage.getItem("bya.orderLinks.v1")).toBeNull();
  });
});

describe("checkout key", () => {
  it("stays the same for repeat submissions and changes only when a new checkout starts", () => {
    const a = currentCheckoutKey();
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    expect(currentCheckoutKey()).toBe(a);
    expect(resetCheckoutKey()).not.toBe(a);
  });
});
