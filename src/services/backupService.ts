// Demo data backup: export / import / reset everything the admin prototype saves in
// this browser. Personal data (orders, customers, reviews) is never exported — it
// lives only in this tab's sessionStorage.
import { demoStores } from "@/lib/demo-store";
import type { Product } from "@/lib/types";
import { productService } from "./productService";
// Importing the services registers their stores.
import "./orderService";
import "./customerService";
import "./whatsappService";
import "./discountService";
import "./settingsService";
import "./contentService";
import "./testimonialService";
import { isDemoMode } from "./api";

export const BACKUP_FORMAT = "being-you-always-demo-backup";
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  products: Product[];
  stores: Record<string, unknown>;
}

export const exportableStores = () => demoStores().filter((s) => s.scope === "local");
export const sessionOnlyStores = () => demoStores().filter((s) => s.scope === "session");

export function buildBackup(now = new Date()): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    products: productService.peekAll(),
    stores: Object.fromEntries(exportableStores().map((s) => [s.key, s.get()])),
  };
}

export type ImportResult = { ok: true; restored: string[]; skipped: string[] } | { ok: false; error: string };

export async function importBackup(raw: string): Promise<ImportResult> {
  let file: unknown;
  try { file = JSON.parse(raw); } catch { return { ok: false, error: "That file isn't valid JSON." }; }
  const f = file as Partial<BackupFile>;
  if (f?.format !== BACKUP_FORMAT) return { ok: false, error: "That isn't a Being You – Always demo backup file." };
  if (typeof f.version !== "number" || f.version > BACKUP_VERSION) return { ok: false, error: "This backup was made by a newer version of the admin." };
  const restored: string[] = [];
  const skipped: string[] = [];
  if (Array.isArray(f.products)) {
    const ok = await productService.importAll(f.products).then(() => true, () => false);
    (ok ? restored : skipped).push("Products");
  }
  for (const s of exportableStores()) {
    if (!f.stores || !(s.key in f.stores)) continue;
    try { (s.importValue(f.stores[s.key]) ? restored : skipped).push(s.label); } catch { skipped.push(s.label); }
  }
  return { ok: true, restored, skipped };
}

/** Restores the original catalogue and every demo store (this browser). */
export async function resetAllDemoData() {
  if (!isDemoMode()) throw new Error("Demo reset is switched off in production.");
  await productService.resetDemo();
  for (const s of demoStores()) s.reset();
}
