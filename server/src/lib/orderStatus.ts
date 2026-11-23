// Order fulfilment steps staff may move between. Payment state is separate and is only
// changed by verified payment events or the audited COD-collection action.
export type OrderStatusKey = "PENDING_PAYMENT" | "NEW" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED";

export const ORDER_TRANSITIONS: Record<OrderStatusKey, OrderStatusKey[]> = {
  PENDING_PAYMENT: [], // becomes NEW only through a verified payment; cancel via the cancel action
  NEW: ["CONFIRMED", "PROCESSING"],
  CONFIRMED: ["PROCESSING"],
  PROCESSING: ["SHIPPED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

/** Orders that can still be cancelled (nothing has left the warehouse). */
export const CANCELLABLE: OrderStatusKey[] = ["PENDING_PAYMENT", "NEW", "CONFIRMED", "PROCESSING"];

export const canTransition = (from: OrderStatusKey, to: OrderStatusKey) => ORDER_TRANSITIONS[from].includes(to);

export const STATUS_LABEL: Record<OrderStatusKey, string> = {
  PENDING_PAYMENT: "Awaiting payment", NEW: "New", CONFIRMED: "Confirmed", PROCESSING: "Packing", SHIPPED: "Shipped",
  DELIVERED: "Delivered", CANCELLED: "Cancelled", RETURNED: "Returned",
};
