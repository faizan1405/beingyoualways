// Shopper accounts. Live email/password sign-in runs on the Hostinger backend, which checks the
// password, sets an httpOnly session cookie and never trusts the browser for identity. While no
// backend URL is configured (this preview) these calls report honestly that email sign-in isn't
// available — a demo session is never faked.
import { API_ENDPOINTS, ApiError, apiRequest, isBackendConfigured } from "./api";

/** Shown whenever email sign-in is asked for without a store server. */
export const EMAIL_SIGNIN_UNAVAILABLE = "Email sign-in needs the store server, which isn't connected in this preview.";

export interface ShopperAccount {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  status: string;
  signInMethod: string;
  googleLinked: boolean;
  hasPassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface ShopperAddress {
  id: string;
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

/** Mirrors the server's shopper order view: amounts are integer paise. */
export interface ShopperOrder {
  orderNumber: string;
  createdAt: string;
  status: string;
  statusLabel: string;
  paymentMethod: "cod" | "razorpay";
  paymentStatus: string;
  items: { productId: string; variantId: string | null; name: string; variantLabel: string; unitPaise: number; quantity: number; lineTotalPaise: number }[];
  totals: { subtotalPaise: number; discountPaise: number; shippingPaise: number; codFeePaise: number; totalPaise: number };
  discountCode: string | null;
  shipTo: { name: string; city: string; state: string; pincode: string };
  payBy: string | null;
  isTest: boolean;
  shipment: { carrier: string | null; trackingNumber: string; trackingUrl: string | null } | null;
}

export type AccountResult = { ok: true; customer: ShopperAccount } | { ok: false; error: string };
export type SimpleResult = { ok: true } | { ok: false; error: string };

const isLive = () => isBackendConfigured();

/** Runs a call and turns a rejected one into a readable message; `signedOut` marks a 401. */
async function run<T>(path: string, init: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown } = {}): Promise<{ ok: true; data: T } | { ok: false; error: string; signedOut?: boolean }> {
  try {
    return { ok: true, data: await apiRequest<T>(path, init) };
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 401) return { ok: false, error: e.message, signedOut: true };
      return { ok: false, error: e.message };
    }
    return { ok: false, error: (e as Error).message };
  }
}

export const customerAuthService = {
  /** Who is signed in right now, or null. A dead/expired session reads as signed out. */
  me: async (): Promise<ShopperAccount | null> => {
    if (!isLive()) return null;
    const r = await run<{ customer: ShopperAccount }>(API_ENDPOINTS.customerMe);
    return r.ok ? r.data.customer : null;
  },

  /**
   * Creates an account. When the email already has orders (or a Google sign-in), the server opens nothing and
   * emails a set-password link to that address instead — `setupLinkSent` tells the page to say so.
   */
  register: async (input: { name: string; email: string; password: string; phone?: string | undefined }): Promise<AccountResult | { ok: true; setupLinkSent: true; message: string }> => {
    if (!isLive()) return { ok: false, error: EMAIL_SIGNIN_UNAVAILABLE };
    const body: Record<string, string> = { name: input.name, email: input.email, password: input.password };
    if (input.phone) body["phone"] = input.phone;
    const r = await run<{ customer?: ShopperAccount; emailConfirmation?: string; setupLinkSent?: boolean; message?: string }>(API_ENDPOINTS.customerRegister, { method: "POST", body });
    if (!r.ok) return { ok: false, error: r.error };
    if (r.data.setupLinkSent || !r.data.customer) return { ok: true, setupLinkSent: true, message: r.data.message ?? "We've emailed you a link to finish setting up your account." };
    return { ok: true, customer: r.data.customer };
  },

  login: async (input: { email: string; password: string }): Promise<AccountResult> => {
    if (!isLive()) return { ok: false, error: EMAIL_SIGNIN_UNAVAILABLE };
    const r = await run<{ customer: ShopperAccount }>(API_ENDPOINTS.customerLogin, { method: "POST", body: input });
    return r.ok ? { ok: true, customer: r.data.customer } : { ok: false, error: r.error };
  },

  logout: async (): Promise<SimpleResult> => {
    if (!isLive()) return { ok: true };
    const r = await run(API_ENDPOINTS.customerLogout, { method: "POST" });
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  },

  verifyEmail: async (token: string): Promise<{ ok: true; emailVerified: boolean } | { ok: false; error: string }> => {
    if (!isLive()) return { ok: false, error: EMAIL_SIGNIN_UNAVAILABLE };
    const r = await run<{ emailVerified: boolean }>(API_ENDPOINTS.customerVerifyEmail, { method: "POST", body: { token } });
    return r.ok ? { ok: true, emailVerified: r.data.emailVerified } : { ok: false, error: r.error };
  },

  resendVerification: async (): Promise<SimpleResult> => {
    if (!isLive()) return { ok: false, error: EMAIL_SIGNIN_UNAVAILABLE };
    const r = await run(API_ENDPOINTS.customerResendVerification, { method: "POST" });
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  },

  /** The server answers the same way whether or not the address is with us. */
  forgotPassword: async (email: string): Promise<SimpleResult> => {
    if (!isLive()) return { ok: false, error: EMAIL_SIGNIN_UNAVAILABLE };
    const r = await run(API_ENDPOINTS.customerForgotPassword, { method: "POST", body: { email } });
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  },

  resetPassword: async (input: { token: string; password: string }): Promise<SimpleResult> => {
    if (!isLive()) return { ok: false, error: EMAIL_SIGNIN_UNAVAILABLE };
    const r = await run(API_ENDPOINTS.customerResetPassword, { method: "POST", body: input });
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  },

  changePassword: async (input: { currentPassword: string; password: string }): Promise<SimpleResult> => {
    if (!isLive()) return { ok: false, error: EMAIL_SIGNIN_UNAVAILABLE };
    const r = await run(API_ENDPOINTS.customerChangePassword, { method: "POST", body: input });
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  },

  profile: async (input: { name: string; phone: string | null }): Promise<AccountResult> => {
    if (!isLive()) return { ok: false, error: EMAIL_SIGNIN_UNAVAILABLE };
    const r = await run<{ customer: ShopperAccount }>(API_ENDPOINTS.customerMe, { method: "PATCH", body: input });
    return r.ok ? { ok: true, customer: r.data.customer } : { ok: false, error: r.error };
  },

  addresses: async (): Promise<{ ok: true; addresses: ShopperAddress[] } | { ok: false; error: string }> => {
    if (!isLive()) return { ok: false, error: EMAIL_SIGNIN_UNAVAILABLE };
    const r = await run<{ addresses: ShopperAddress[] }>(API_ENDPOINTS.customerAddresses);
    return r.ok ? { ok: true, addresses: r.data.addresses } : { ok: false, error: r.error };
  },

  addAddress: async (input: Omit<ShopperAddress, "id">): Promise<{ ok: true; address: ShopperAddress } | { ok: false; error: string }> => {
    if (!isLive()) return { ok: false, error: EMAIL_SIGNIN_UNAVAILABLE };
    const r = await run<{ address: ShopperAddress }>(API_ENDPOINTS.customerAddresses, { method: "POST", body: input });
    return r.ok ? { ok: true, address: r.data.address } : { ok: false, error: r.error };
  },

  deleteAddress: async (id: string): Promise<SimpleResult> => {
    if (!isLive()) return { ok: false, error: EMAIL_SIGNIN_UNAVAILABLE };
    const r = await run(API_ENDPOINTS.customerAddressDelete.replace(":id", encodeURIComponent(id)), { method: "POST" });
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  },

  orders: async (): Promise<{ ok: true; orders: ShopperOrder[] } | { ok: false; error: string }> => {
    if (!isLive()) return { ok: false, error: EMAIL_SIGNIN_UNAVAILABLE };
    const r = await run<{ orders: ShopperOrder[] }>(API_ENDPOINTS.customerOrders);
    return r.ok ? { ok: true, orders: r.data.orders } : { ok: false, error: r.error };
  },

  /** Brings an earlier order into the account with the key already in its private link. */
  claimOrder: async (input: { orderNumber: string; token: string }): Promise<SimpleResult> => {
    if (!isLive()) return { ok: false, error: EMAIL_SIGNIN_UNAVAILABLE };
    const r = await run(API_ENDPOINTS.customerClaimOrder, { method: "POST", body: input });
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  },

  /** Whether Google sign-in is wired up on the server (never starts a flow by itself). */
  googleStatus: async (): Promise<{ configured: boolean }> => {
    if (!isLive()) return { configured: false };
    try {
      return await apiRequest<{ configured: boolean }>(API_ENDPOINTS.googleStatus);
    } catch {
      return { configured: false };
    }
  },
};
