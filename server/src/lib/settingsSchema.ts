import { z } from "zod";

import { INDIAN_STATES } from "./india.js";

// Owner-controlled store rules. Nothing here has a made-up default: shipping and COD start
// switched off with blank amounts, so checkout stays blocked until the owner fills them in.

const paise = z.number().int().min(0).max(10_000_000_00);
const regions = <M extends [string, ...string[]]>(modes: M) =>
  z.object({
    mode: z.enum(modes),
    states: z.array(z.enum(INDIAN_STATES)).max(INDIAN_STATES.length).default([]),
    /** 1–6 leading digits, e.g. "560" covers every PIN code starting 560 */
    pincodePrefixes: z.array(z.string().trim().regex(/^[1-9]\d{0,5}$/, "PIN code prefixes are 1–6 digits")).max(5_000).default([]),
  });

export const shippingSettingsSchema = z
  .object({
    enabled: z.boolean(),
    flatFeePaise: paise.nullable(),
    freeAbovePaise: paise.nullable(),
    regions: regions(["all_india", "states", "pincodes"]),
    estimateMinDays: z.number().int().min(0).max(60).nullable(),
    estimateMaxDays: z.number().int().min(0).max(90).nullable(),
    estimateNote: z.string().trim().max(200).default(""),
    /** most units of one size/shade per order */
    maxQtyPerLine: z.number().int().min(1).max(100).default(10),
  })
  .refine((s) => s.estimateMinDays == null || s.estimateMaxDays == null || s.estimateMinDays <= s.estimateMaxDays, { message: "The earliest delivery day can't be after the latest.", path: ["estimateMinDays"] });
export type ShippingSettings = z.infer<typeof shippingSettingsSchema>;

export const codSettingsSchema = z
  .object({
    enabled: z.boolean(),
    feePaise: paise.nullable(),
    minOrderPaise: paise.nullable(),
    maxOrderPaise: paise.nullable(),
    regions: regions(["all_shipping", "states", "pincodes"]),
  })
  .refine((s) => s.minOrderPaise == null || s.maxOrderPaise == null || s.minOrderPaise <= s.maxOrderPaise, { message: "The COD minimum can't be above the maximum.", path: ["minOrderPaise"] });
export type CodSettings = z.infer<typeof codSettingsSchema>;

export const storeSettingsSchema = z.object({
  contactEmail: z.union([z.literal(""), z.string().trim().email().max(191)]).default(""),
  contactPhone: z.string().trim().max(20).regex(/^[+0-9 ]*$/, "Digits, spaces and + only").default(""),
  supportNote: z.string().trim().max(300).default(""),
});
export type StoreSettings = z.infer<typeof storeSettingsSchema>;

export const DEFAULT_SHIPPING: ShippingSettings = {
  enabled: false, flatFeePaise: null, freeAbovePaise: null, regions: { mode: "all_india", states: [], pincodePrefixes: [] },
  estimateMinDays: null, estimateMaxDays: null, estimateNote: "", maxQtyPerLine: 10,
};
export const DEFAULT_COD: CodSettings = { enabled: false, feePaise: null, minOrderPaise: null, maxOrderPaise: null, regions: { mode: "all_shipping", states: [], pincodePrefixes: [] } };
export const DEFAULT_STORE: StoreSettings = { contactEmail: "", contactPhone: "", supportNote: "" };

/** What still blocks orders, in owner-facing words. Empty = shipping is ready. */
export function shippingProblems(s: ShippingSettings): string[] {
  const p: string[] = [];
  if (!s.enabled) p.push("Shipping is switched off in Admin → Settings.");
  if (s.flatFeePaise == null) p.push("Set the shipping charge (enter 0 for free shipping).");
  if (s.estimateMinDays == null || s.estimateMaxDays == null) p.push("Set the delivery estimate (earliest and latest working days).");
  if (s.regions.mode === "states" && s.regions.states.length === 0) p.push("Choose at least one state you deliver to.");
  if (s.regions.mode === "pincodes" && s.regions.pincodePrefixes.length === 0) p.push("Add at least one PIN code (or prefix) you deliver to.");
  return p;
}

export function codProblems(c: CodSettings): string[] {
  const p: string[] = [];
  if (!c.enabled) p.push("Cash on Delivery is switched off.");
  if (c.feePaise == null) p.push("Set the COD charge (enter 0 if there is none).");
  if (c.regions.mode === "states" && c.regions.states.length === 0) p.push("Choose at least one state for COD.");
  if (c.regions.mode === "pincodes" && c.regions.pincodePrefixes.length === 0) p.push("Add at least one PIN code (or prefix) for COD.");
  return p;
}

type Regions = { mode: string; states: string[]; pincodePrefixes: string[] };
/** True when the address falls inside the region list ("all_*" modes match everything). */
export function inRegion(r: Regions, state: string, pincode: string): boolean {
  if (r.mode === "states") return r.states.includes(state);
  if (r.mode === "pincodes") return r.pincodePrefixes.some((prefix) => pincode.startsWith(prefix));
  return true;
}

export const estimateText = (s: ShippingSettings) =>
  s.estimateMinDays == null || s.estimateMaxDays == null
    ? null
    : s.estimateMinDays === s.estimateMaxDays
      ? `Usually delivered in ${s.estimateMaxDays} working day${s.estimateMaxDays === 1 ? "" : "s"}`
      : `Usually delivered in ${s.estimateMinDays}–${s.estimateMaxDays} working days`;
