import { DEMO_MODE } from "@/services/api";
// Versioned demo persistence for the admin prototype.
//
// - "local" stores (non-personal: content, settings, campaigns, discounts, chatbot…) use
//   localStorage, so edits survive refreshes and show in other tabs of this browser.
// - "session" stores (anything that can hold a person's details: orders, customers, reviews)
//   use sessionStorage — they survive a refresh but are cleared when the tab closes.
// Every value is wrapped as { v, data }; a version bump re-seeds (or migrates) once.
// Swap a store's body for Hostinger REST calls later — pages only use the service API.

export type StoreScope = "local" | "session";

export interface DemoStore<T> {
  key: string;
  label: string;
  scope: StoreScope;
  /** Current value (stable reference until the next change — safe for useSyncExternalStore). */
  get: () => T;
  /** Seed value, used for server rendering and the first hydration pass. */
  server: () => T;
  set: (next: T | ((prev: T) => T)) => T;
  reset: () => void;
  subscribe: (fn: () => void) => () => void;
  /** Accepts imported data only if it passes the store's shape check. */
  importValue: (value: unknown) => boolean;
}

interface Options<T> {
  key: string;
  label: string;
  version: number;
  seed: () => T;
  scope?: StoreScope;
  /** Shape check for stored / imported data. */
  validate: (v: unknown) => v is T;
  /** Upgrade data saved under an older version; return null to re-seed. */
  migrate?: (old: unknown, fromVersion: number) => T | null;
  /** Strip values that cannot be kept (e.g. temporary blob: video URLs) before saving. */
  serialize?: (v: T) => T;
}

export class StorageFullError extends Error {
  constructor() {
    super("This browser's demo storage is full. Remove large uploaded images or reset demo data, then try again.");
  }
}

const registry: DemoStore<unknown>[] = [];
export const demoStores = () => registry;

// Production builds never read or write demo data in the browser (see DEMO_MODE in services/api).
const area = (scope: StoreScope): Storage | null => {
  if (typeof window === "undefined" || !DEMO_MODE) return null;
  try { return scope === "local" ? window.localStorage : window.sessionStorage; } catch { return null; }
};

export function createDemoStore<T>(o: Options<T>): DemoStore<T> {
  const scope = o.scope ?? "local";
  const seedValue = o.seed();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((fn) => fn());

  const read = (): T => {
    const s = area(scope);
    if (!s) return seedValue;
    try {
      const raw = s.getItem(o.key);
      if (!raw) return o.seed();
      const env = JSON.parse(raw) as { v?: number; data?: unknown };
      if (env.v === o.version && o.validate(env.data)) return env.data;
      const up = o.migrate?.(env.data, env.v ?? 0) ?? null;
      if (up && o.validate(up)) { write(up); return up; }
      return o.seed();
    } catch { return o.seed(); }
  };
  const write = (v: T) => {
    const s = area(scope);
    if (!s) return;
    try { s.setItem(o.key, JSON.stringify({ v: o.version, data: o.serialize ? o.serialize(v) : v })); }
    catch { throw new StorageFullError(); }
  };

  let value: T = read();

  if (typeof window !== "undefined" && scope === "local") {
    window.addEventListener("storage", (e) => { if (e.key === o.key) { value = read(); emit(); } });
  }

  const store: DemoStore<T> = {
    key: o.key,
    label: o.label,
    scope,
    get: () => value,
    server: () => seedValue,
    set: (next) => {
      const v = typeof next === "function" ? (next as (p: T) => T)(value) : next;
      write(v); // throws StorageFullError and leaves the old value in place
      value = v;
      emit();
      return v;
    },
    reset: () => {
      area(scope)?.removeItem(o.key);
      value = o.seed();
      emit();
    },
    subscribe: (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    importValue: (v) => {
      if (!o.validate(v)) return false;
      store.set(v);
      return true;
    },
  };
  registry.push(store as DemoStore<unknown>);
  return store;
}

export const isArrayOf = <T,>(v: unknown, check: (x: Record<string, unknown>) => boolean): v is T[] =>
  Array.isArray(v) && v.every((x) => x !== null && typeof x === "object" && check(x as Record<string, unknown>));

export const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);

export const nowIso = () => new Date().toISOString();
export const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
