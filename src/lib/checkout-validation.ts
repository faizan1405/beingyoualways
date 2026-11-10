import type { AddressType, PaymentMethod } from "@/lib/types";

export interface CheckoutForm {
  name: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  addressType: AddressType;
}

export type CheckoutErrors = Partial<Record<keyof CheckoutForm | "payment", string>>;

export type CheckoutStep = "contact" | "address" | "payment" | "review";
export const CHECKOUT_STEPS: { id: CheckoutStep; label: string }[] = [
  { id: "contact", label: "Contact" },
  { id: "address", label: "Delivery" },
  { id: "payment", label: "Payment" },
  { id: "review", label: "Review" },
];

export const emptyCheckout: CheckoutForm = {
  name: "", email: "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "", addressType: "home",
};

const digits = (s: string) => s.replace(/\D/g, "");
/** Accepts 10 digits, optionally prefixed with +91 / 91 / 0. */
export const normalisePhone = (s: string) => {
  const d = digits(s);
  if (d.length === 12 && d.startsWith("91")) return d.slice(2);
  if (d.length === 11 && d.startsWith("0")) return d.slice(1);
  return d;
};

export function validateContact(f: Pick<CheckoutForm, "name" | "email" | "phone">): CheckoutErrors {
  const e: CheckoutErrors = {};
  if (f.name.trim().length < 2) e.name = "Please enter your full name";
  if (!/^[6-9]\d{9}$/.test(normalisePhone(f.phone))) e.phone = "Enter a valid 10-digit Indian mobile number";
  if (!f.email.trim()) e.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = "Enter a valid email address";
  return e;
}

export function validateAddress(f: Pick<CheckoutForm, "line1" | "city" | "state" | "pincode">): CheckoutErrors {
  const e: CheckoutErrors = {};
  if (f.line1.trim().length < 5) e.line1 = "Please enter your house number, building and street";
  if (!f.city.trim()) e.city = "City is required";
  if (!f.state.trim()) e.state = "Please select your state";
  if (!/^[1-9]\d{5}$/.test(f.pincode.trim())) e.pincode = "Enter a valid 6-digit PIN code";
  return e;
}

export function validatePayment(method: PaymentMethod | null): CheckoutErrors {
  return method ? {} : { payment: "Please choose a payment method" };
}

export function validateStep(step: CheckoutStep, f: CheckoutForm, method: PaymentMethod | null): CheckoutErrors {
  if (step === "contact") return validateContact(f);
  if (step === "address") return validateAddress(f);
  if (step === "payment") return validatePayment(method);
  return validateCheckout(f, method);
}

/** Whole-form check used before the review can be submitted. */
export function validateCheckout(f: CheckoutForm, method: PaymentMethod | null = "razorpay"): CheckoutErrors {
  return { ...validateContact(f), ...validateAddress(f), ...validatePayment(method) };
}

/** First step that still has an error — used to send shoppers back to fix it. */
export function firstInvalidStep(f: CheckoutForm, method: PaymentMethod | null): CheckoutStep | null {
  for (const s of ["contact", "address", "payment"] as const) if (Object.keys(validateStep(s, f, method)).length) return s;
  return null;
}

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
];
