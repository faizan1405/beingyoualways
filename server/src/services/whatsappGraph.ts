// Thin client for Meta's Graph API (WhatsApp Cloud API). The access token travels only in the
// Authorization header from this server to graph.facebook.com — never in a URL, log line or response.
import type { Config } from "../config.js";
import { classifyMetaError, describeMetaError, type ErrorKind } from "../lib/whatsapp.js";

export class MetaApiError extends Error {
  constructor(
    public operation: string,
    public httpStatus: number | null,
    public code: number | null,
    public subcode: number | null,
    public title: string,
    public detail: string | null,
    public traceId: string | null,
    /** the request may have reached Meta (timeout) — resending could duplicate the message */
    public ambiguous = false,
  ) {
    super(title);
    this.name = "MetaApiError";
  }
  get kind(): ErrorKind { return classifyMetaError(this.httpStatus, this.code); }
  /** plain-English reason for admins */
  get reason(): string { return this.code !== null ? describeMetaError(this.code, this.title) : this.title; }
}

export interface GraphClient {
  get<T = unknown>(operation: string, path: string, query?: Record<string, string>): Promise<T>;
  post<T = unknown>(operation: string, path: string, body: unknown): Promise<T>;
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal; redirect?: "manual" }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/** Real client. `fetchImpl` exists for unit tests of the error handling. */
export function createGraphClient(wa: NonNullable<Config["whatsapp"]>, fetchImpl: FetchLike = fetch as unknown as FetchLike, timeoutMs = 10_000): GraphClient {
  const base = `https://graph.facebook.com/${wa.graphVersion}`;
  async function call<T>(operation: string, method: "GET" | "POST", path: string, query?: Record<string, string>, body?: unknown): Promise<T> {
    const url = `${base}/${path.replace(/^\//, "")}${query && Object.keys(query).length ? `?${new URLSearchParams(query).toString()}` : ""}`;
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await fetchImpl(url, {
        method,
        headers: { Authorization: `Bearer ${wa.accessToken}`, Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "manual",
      });
    } catch (e) {
      const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      throw new MetaApiError(operation, null, null, null, timedOut ? "Meta didn't answer in time." : "Couldn't reach Meta's servers (network problem).", null, null, timedOut);
    }
    const text = await res.text();
    let json: unknown = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    if (!res.ok) {
      const err = (json as { error?: { message?: string; code?: number; error_subcode?: number; error_user_title?: string; error_user_msg?: string; error_data?: { details?: string }; fbtrace_id?: string } } | null)?.error;
      throw new MetaApiError(
        operation, res.status, typeof err?.code === "number" ? err.code : null, typeof err?.error_subcode === "number" ? err.error_subcode : null,
        (err?.error_user_title || err?.message || `Meta answered with HTTP ${res.status}`).slice(0, 300),
        (err?.error_data?.details || err?.error_user_msg || null)?.slice(0, 500) ?? null,
        err?.fbtrace_id?.slice(0, 80) ?? null,
      );
    }
    return json as T;
  }
  return {
    get: (op, path, query) => call(op, "GET", path, query),
    post: (op, path, body) => call(op, "POST", path, undefined, body),
  };
}
