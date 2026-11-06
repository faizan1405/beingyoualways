export interface CheckoutForm {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

export type CheckoutErrors = Partial<Record<keyof CheckoutForm, string>>;

export function validateCheckout(f: CheckoutForm): CheckoutErrors {
  const e: CheckoutErrors = {};
  if (f.name.trim().length < 2) e.name = "Please enter your full name";
  if (!/^[6-9]\d{9}$/.test(f.phone.replace(/\D/g, "").slice(-10)) || f.phone.replace(/\D/g, "").length < 10)
    e.phone = "Enter a valid 10-digit Indian mobile number";
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Enter a valid email address";
  if (f.address.trim().length < 5) e.address = "Please enter your full address";
  if (!f.city.trim()) e.city = "City is required";
  if (!f.state.trim()) e.state = "Please select your state";
  if (!/^[1-9]\d{5}$/.test(f.pincode.trim())) e.pincode = "Enter a valid 6-digit PIN code";
  return e;
}

export const INDIAN_STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
  "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha", "Punjab", "Rajasthan",
  "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Other",
];
