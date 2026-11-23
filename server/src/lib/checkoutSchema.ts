import { z } from "zod";

import { INDIAN_STATES, isIndianMobile, normalizeIndianPhone } from "./india.js";

// Everything the browser sends at checkout. Prices are never accepted from the browser —
// `seenUnitPrice` is only compared with the database price to tell the shopper it changed.

const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Invalid id");
const text = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `${label} is required`).max(max, `${label} is too long`).refine((s) => !/[\u0000-\u001f\u007f<>]/.test(s), `${label} has characters that aren't allowed`);

export const cartLineSchema = z.object({
  productId: id,
  variantId: id,
  quantity: z.number().int().min(1, "Quantity must be at least 1").max(100),
  seenUnitPrice: z.number().min(0).max(1_000_000).optional(),
});
export type CartLineInput = z.infer<typeof cartLineSchema>;

export const cartSchema = z.object({ lines: z.array(cartLineSchema).min(1, "Your bag is empty").max(30, "Too many different items in one order") });

export const discountCodeSchema = z.string().trim().toUpperCase().max(40).regex(/^[A-Z0-9_-]*$/, "Discount codes use letters, numbers, - and _ only");

export const contactSchema = z.object({
  name: text(2, 120, "Full name"),
  email: z.string().trim().toLowerCase().max(191).email("Enter a valid email address"),
  phone: z.string().max(20).transform(normalizeIndianPhone).refine(isIndianMobile, "Enter a valid 10-digit Indian mobile number"),
});

export const addressSchema = z.object({
  line1: text(5, 255, "House number, building and street"),
  line2: z.string().trim().max(255).refine((s) => !/[\u0000-\u001f\u007f<>]/.test(s), "Address has characters that aren't allowed").default(""),
  city: text(2, 100, "City"),
  state: z.enum(INDIAN_STATES, { errorMap: () => ({ message: "Please select your state" }) }),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code"),
  type: z.enum(["home", "work", "other"]).default("home"),
});

export const paymentMethodSchema = z.enum(["cod", "razorpay"]);
export type PaymentChoice = z.infer<typeof paymentMethodSchema>;

export const quoteSchema = cartSchema.extend({
  destination: z.object({ state: z.enum(INDIAN_STATES), pincode: z.string().trim().regex(/^[1-9]\d{5}$/) }).optional(),
  paymentMethod: paymentMethodSchema.optional(),
  discountCode: discountCodeSchema.optional(),
});
export type QuoteInput = z.infer<typeof quoteSchema>;

export const placeOrderSchema = cartSchema.extend({
  /** random id the browser creates once per checkout; repeat submissions return the same order */
  checkoutKey: z.string().uuid("Refresh the checkout page and try again"),
  contact: contactSchema,
  address: addressSchema,
  paymentMethod: paymentMethodSchema,
  discountCode: discountCodeSchema.optional(),
});
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

export const orderAccessSchema = z.object({
  orderNumber: z.string().trim().toUpperCase().regex(/^BYA-\d{6}-[A-Z0-9]{5}$/, "Invalid order number"),
  token: z.string().regex(/^[A-Za-z0-9_-]{20,100}$/, "Invalid order link"),
});

export const razorpayResultSchema = orderAccessSchema.extend({
  razorpay_order_id: z.string().regex(/^order_[A-Za-z0-9]{6,40}$/),
  razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]{6,40}$/),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/),
});

export const paymentProblemSchema = orderAccessSchema.extend({
  kind: z.enum(["cancelled", "failed"]),
  razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]{6,40}$/).optional(),
  reason: z.string().trim().max(200).optional(),
});
