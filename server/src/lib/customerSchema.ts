import { z } from "zod";

/** Shopper-side validation. Messages are written for the person filling the form, not for a developer. */
const email = z.string().trim().toLowerCase().email("Enter a valid email address.").max(191);
const phone = z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number.");
const name = z.string().trim().min(2, "Enter your name.").max(120);
/** Shoppers are asked for 10 characters; staff accounts ask for 12 (see password.ts). */
const password = z.string().min(10, "Use at least 10 characters.").max(200);

export const registerSchema = z.object({
  name,
  email,
  phone: phone.optional(),
  password,
});

export const customerLoginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(200),
});

export const forgotPasswordSchema = z.object({ email });

export const tokenSchema = z.object({ token: z.string().trim().min(20).max(200, "That link looks wrong.") });

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(20).max(200, "That link looks wrong."),
  password,
});

export const profileSchema = z.object({
  name,
  phone: phone.nullable().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(200),
  password,
});

export const addressSchema = z.object({
  label: z.string().trim().min(1).max(40).default("Home"),
  name: z.string().trim().min(2, "Enter the recipient's name.").max(120),
  phone,
  line1: z.string().trim().min(3, "Enter the flat / house and street.").max(255),
  line2: z.string().trim().max(255).optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  pincode: z.string().trim().regex(/^\d{6}$/, "Enter a valid 6-digit PIN code."),
  isDefault: z.boolean().optional(),
});

export const addressUpdateSchema = addressSchema.partial();

/**
 * A shopper brings an earlier order into their account with the private link they were given. The key
 * is the one already in that link — the same proof the order page uses — so no second secret exists.
 */
export const claimOrderSchema = z.object({
  orderNumber: z.string().trim().min(6).max(30),
  token: z.string().trim().min(16).max(64),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type CustomerLoginInput = z.infer<typeof customerLoginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type AddressUpdate = z.infer<typeof addressUpdateSchema>;
export type ClaimOrderInput = z.infer<typeof claimOrderSchema>;
