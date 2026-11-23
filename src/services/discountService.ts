// Discount codes (demo). Saved in this browser for the admin preview only —
// checkout does not apply codes until the Hostinger backend validates them.
import { createDemoStore, isArrayOf, newId } from "@/lib/demo-store";
import { validateDiscount } from "@/lib/discounts";
import type { Discount } from "@/lib/types";

// Starts empty: no offers have been agreed with the client.
export const discountStore = createDemoStore<Discount[]>({
  key: "bya.demo.discounts", label: "Discounts", version: 1,
  seed: () => [],
  validate: (v): v is Discount[] => isArrayOf<Discount>(v, (d) => typeof d["code"] === "string" && (d["type"] === "percent" || d["type"] === "fixed")),
});

export const blankDiscount = (): Discount => ({ id: newId("d"), code: "", type: "percent", value: 10, used: 0, active: false });

export const discountService = {
  list: () => discountStore.get(),
  byCode: (code: string) => discountStore.get().find((d) => d.code === code.trim().toUpperCase()) ?? null,
  save: (d: Discount) => {
    const clean = { ...d, code: d.code.trim().toUpperCase() };
    const errors = validateDiscount(clean, discountStore.get());
    if (errors.length) throw new Error(errors.join(" "));
    discountStore.set((all) => (all.some((x) => x.id === clean.id) ? all.map((x) => (x.id === clean.id ? clean : x)) : [clean, ...all]));
    return clean;
  },
  remove: (id: string) => discountStore.set((all) => all.filter((x) => x.id !== id)),
};
