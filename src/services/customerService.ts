// Customer repository (mock).
import { customers } from "@/lib/mock-data";

const r = <T,>(v: T) => Promise.resolve(structuredClone(v));

export const DEMO_CUSTOMER_ID = "c1";

export const customerService = {
  list: () => r(customers),
  get: (id: string) => r(customers.find((c) => c.id === id) ?? null),
};
