import type { OrderStatus, PaymentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const tone: Record<string, string> = {
  good: "bg-success/15 text-success",
  warn: "bg-warning/20 text-foreground",
  bad: "bg-destructive/12 text-destructive",
  info: "bg-sage/30 text-sage-foreground",
  muted: "bg-secondary text-muted-foreground",
};

const statusTone: Record<OrderStatus, keyof typeof tone> = {
  placed: "warn", confirmed: "info", packed: "info", shipped: "info", delivered: "good", cancelled: "bad",
};
const payTone: Record<PaymentStatus, keyof typeof tone> = {
  paid: "good", pending: "warn", failed: "bad", refunded: "muted", cod: "info",
};

export function Pill({ t, children }: { t: keyof typeof tone; children: string }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize", tone[t])}>{children}</span>;
}
export const OrderStatusBadge = ({ status }: { status: OrderStatus }) => <Pill t={statusTone[status]}>{status}</Pill>;
export const PaymentBadge = ({ status }: { status: PaymentStatus }) => <Pill t={payTone[status]}>{status === "cod" ? "COD" : status}</Pill>;
