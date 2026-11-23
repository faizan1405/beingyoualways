import { CloudOff, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OrderStatusKey, PaymentStatusKey } from "@/services/shopService";

/** Loads server data for an admin screen; errors are shown, never replaced with sample data. */
export function useLive<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const reload = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    try { const d = await fn(); if (n === seq.current) { setData(d); setError(null); } }
    catch (e) { if (n === seq.current) setError(e instanceof Error ? e.message : "Can't reach the store server."); }
    finally { if (n === seq.current) setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { void reload(); }, [reload]);
  return { data, setData, error, loading, reload };
}

export function LiveState({ error, loading, onRetry }: { error: string | null; loading: boolean; onRetry: () => void }) {
  if (error) return (
    <div role="alert" className="rounded-xl border border-destructive/40 bg-card p-6 text-center">
      <CloudOff className="mx-auto size-7 text-destructive" />
      <p className="mt-2 text-sm">{error}</p>
      <Button className="mt-4" variant="outline" onClick={onRetry}>Try again</Button>
    </div>
  );
  if (loading) return <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading from the store database…</p>;
  return null;
}

export const ORDER_STATUS_TEXT: Record<OrderStatusKey, string> = {
  PENDING_PAYMENT: "Awaiting payment", NEW: "New", CONFIRMED: "Confirmed", PROCESSING: "Packing", SHIPPED: "Shipped", DELIVERED: "Delivered", CANCELLED: "Cancelled", RETURNED: "Returned",
};
export const PAYMENT_STATUS_TEXT: Record<PaymentStatusKey, string> = {
  PENDING: "Unpaid (online)", COD_PENDING: "COD — not collected", PAID: "Paid", FAILED: "Failed", CANCELLED: "Cancelled", REFUNDED: "Refunded",
};
const tone = (k: string) =>
  ["PAID", "DELIVERED"].includes(k) ? "bg-success/12 text-success border-success/30"
  : ["FAILED", "CANCELLED", "RETURNED", "REFUNDED"].includes(k) ? "bg-destructive/10 text-destructive border-destructive/30"
  : ["PENDING", "PENDING_PAYMENT", "COD_PENDING"].includes(k) ? "bg-accent/12 text-foreground border-accent/40"
  : "bg-primary/8 text-primary border-primary/25";
export function StatusPill({ kind, value }: { kind: "order" | "payment"; value: string }) {
  const text = kind === "order" ? ORDER_STATUS_TEXT[value as OrderStatusKey] : PAYMENT_STATUS_TEXT[value as PaymentStatusKey];
  return <span className={cn("inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium", tone(value))}>{text ?? value}</span>;
}
export const TestTag = () => <span className="ml-1.5 rounded border border-accent/50 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider">Test</span>;

export const istDateTime = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
export const istDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
export const todayIst = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
export const daysAgoIst = (n: number) => new Date(Date.now() + 330 * 60_000 - n * 86_400_000).toISOString().slice(0, 10);
