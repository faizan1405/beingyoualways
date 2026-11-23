// Store settings (demo). Only non-secret values live here. API keys and passwords are
// entered on the Hostinger server, never in admin forms, code or browser storage.
import { brandConfig } from "@/config/business";
import { createDemoStore, isObject } from "@/lib/demo-store";

export interface StoreSettings {
  storeName: string;
  shipping: { fee: number | null; freeAbove: number | null; deliveryNote: string; clientConfirmed: boolean };
  payments: { cod: "pending" | "offered" | "not-offered"; codCharge: number | null; codNote: string; clientConfirmed: boolean };
  /** Number the client says is on WhatsApp Business — not verified until the API is connected. */
  whatsappNumber: string;
}

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: brandConfig.name,
  // Nothing is invented: shipping and COD stay blank / pending until the client confirms.
  shipping: { fee: null, freeAbove: null, deliveryNote: "", clientConfirmed: false },
  payments: { cod: "pending", codCharge: null, codNote: "", clientConfirmed: false },
  whatsappNumber: "",
};

export const settingsStore = createDemoStore<StoreSettings>({
  key: "bya.demo.settings", label: "Store settings", version: 1,
  seed: () => structuredClone(DEFAULT_SETTINGS),
  validate: (v): v is StoreSettings => isObject(v) && typeof v["storeName"] === "string" && isObject(v["shipping"]) && isObject(v["payments"]),
});

/** Integration status — all false until the Hostinger backend and approved credentials exist. */
export const INTEGRATIONS = [
  { key: "hostinger", label: "Hostinger backend", connected: false, note: "Needed for real orders, accounts, stock, uploads and secure admin sign-in." },
  { key: "razorpay", label: "Razorpay payments", connected: false, note: "Keys are added on the server only. Checkout shows payment as not connected." },
  { key: "whatsapp", label: "WhatsApp Business API", connected: false, note: "Needs an approved WhatsApp Business account; nothing is sent until then." },
  { key: "google-login", label: "Google sign-in", connected: false, note: "Needs the backend OAuth flow; the sign-in button explains it isn't live yet." },
  { key: "whatsapp-otp", label: "WhatsApp OTP sign-in", connected: false, note: "Needs the WhatsApp API and backend sessions; OTP screens are demo only." },
  { key: "maps", label: "Google Maps", connected: true, note: "Public map embed on the Contact page — no key needed." },
] as const;

export function validateSettings(s: StoreSettings): string[] {
  const e: string[] = [];
  if (s.storeName.trim().length < 2) e.push("Store name is required.");
  const money = (n: number | null) => n == null || (Number.isFinite(n) && n >= 0);
  if (!money(s.shipping.fee) || !money(s.shipping.freeAbove) || !money(s.payments.codCharge)) e.push("Amounts must be 0 or more, or left blank.");
  if (s.shipping.clientConfirmed && s.shipping.fee == null) e.push("Enter the shipping charge before marking it confirmed by the client.");
  if (s.payments.clientConfirmed && s.payments.cod === "pending") e.push("Choose whether COD is offered before marking it confirmed.");
  if (s.whatsappNumber && !/^\+?[0-9 ]{10,16}$/.test(s.whatsappNumber.trim())) e.push("WhatsApp number should be digits only, e.g. +91 97374 22248.");
  return e;
}

export const settingsService = {
  get: () => settingsStore.get(),
  save: (s: StoreSettings) => {
    const errors = validateSettings(s);
    if (errors.length) throw new Error(errors.join(" "));
    settingsStore.set(s);
  },
};
