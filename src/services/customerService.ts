// Customer repository (demo). Customer records are personal data, so they stay in
// sessionStorage (this tab only). Real accounts will come from the Hostinger backend.
import { countsAsSale } from "@/lib/dashboard";
import { createDemoStore, isArrayOf } from "@/lib/demo-store";
import { customers as seed } from "@/lib/mock-data";
import type { Customer, Order } from "@/lib/types";
import { orderStore } from "./orderService";

export const DEMO_CUSTOMER_ID = "c1";

export const customerStore = createDemoStore<Customer[]>({
  key: "bya.demo.customers",
  label: "Customers",
  version: 2,
  scope: "session",
  seed: () => structuredClone(seed),
  validate: (v): v is Customer[] => isArrayOf<Customer>(v, (c) => typeof c["id"] === "string" && typeof c["name"] === "string"),
});

/** Order count and spend always come from the orders themselves. */
export const withStats = (c: Customer, orders: Order[]): Customer => {
  const own = orders.filter((o) => o.customerId === c.id);
  return { ...c, orderCount: own.length, totalSpent: own.filter(countsAsSale).reduce((s, o) => s + o.total, 0) };
};

const r = <T,>(v: T) => Promise.resolve(structuredClone(v));

export const customerService = {
  list: () => r(customerStore.get().map((c) => withStats(c, orderStore.get()))),
  get: (id: string) => { const c = customerStore.get().find((x) => x.id === id); return r(c ? withStats(c, orderStore.get()) : null); },
  update: (id: string, patch: Partial<Pick<Customer, "status" | "notes" | "segment">>) => {
    customerStore.set((all) => all.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    return customerService.get(id);
  },
};
