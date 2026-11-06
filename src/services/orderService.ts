// Order repository (mock). Replace with REST calls to the Hostinger backend.
import { orders as seed, salesSeries } from "@/lib/mock-data";
import type { Order, OrderStatus } from "@/lib/types";

let store: Order[] = structuredClone(seed);
const r = <T,>(v: T) => Promise.resolve(structuredClone(v));

export const orderService = {
  list: () => r(store),
  get: (id: string) => r(store.find((o) => o.id === id) ?? null),
  forCustomer: (customerId: string) => r(store.filter((o) => o.customerId === customerId)),
  updateStatus: (id: string, status: OrderStatus) => {
    store = store.map((o) => (o.id === id ? { ...o, status } : o));
    return r(store.find((o) => o.id === id)!);
  },
  salesSeries: () => r(salesSeries),
};
