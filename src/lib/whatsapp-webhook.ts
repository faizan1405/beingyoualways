// Meta WhatsApp webhook handling — reference logic for the HOSTINGER backend.
// Runs anywhere WebCrypto exists (Node 18+, browsers, workers) but must only be
// called on the server: it needs the app secret / verify token from server env.
// The storefront never imports this module at runtime.
import type { DeliveryState } from "@/lib/whatsapp-cloud";

/** GET /webhook — Meta's subscription handshake. Returns the challenge to echo, or null (→ 403). */
export function verifySubscription(params: URLSearchParams, verifyToken: string): string | null {
  if (!verifyToken) return null;
  const ok = params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === verifyToken;
  return ok ? params.get("hub.challenge") : null;
}

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

/** Constant-time string compare (same length check first). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** POST /webhook — check X-Hub-Signature-256 ("sha256=<hex>") over the RAW body with the app secret. */
export async function verifySignature(rawBody: string, header: string | null, appSecret: string): Promise<boolean> {
  if (!header?.startsWith("sha256=") || !appSecret) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return safeEqual(header.slice(7).toLowerCase(), hex(sig));
}

export type WebhookEvent =
  | { kind: "message"; dedupeKey: string; messageId: string; from: string; type: string; text?: string | undefined; timestamp: string }
  | { kind: "status"; dedupeKey: string; messageId: string; status: DeliveryState; recipient: string; timestamp: string; errors: { code: number; title: string }[] }
  | { kind: "template"; dedupeKey: string; template: string; event: string }
  | { kind: "other"; dedupeKey: string; field: string };

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const STATES: DeliveryState[] = ["sent", "delivered", "read", "failed"];

/** Flattens Meta's payload into events. Each has a dedupe key so retries are processed once. */
export function parseWebhook(payload: unknown): WebhookEvent[] {
  const out: WebhookEvent[] = [];
  for (const entry of arr(obj(payload)["entry"])) {
    for (const change of arr(obj(entry)["changes"])) {
      const field = str(obj(change)["field"]);
      const value = obj(obj(change)["value"]);
      if (field === "messages") {
        for (const m of arr(value["messages"]).map(obj)) {
          const id = str(m["id"]);
          if (id) out.push({ kind: "message", dedupeKey: `msg:${id}`, messageId: id, from: str(m["from"]), type: str(m["type"]), text: str(obj(m["text"])["body"]) || undefined, timestamp: str(m["timestamp"]) });
        }
        for (const s of arr(value["statuses"]).map(obj)) {
          const id = str(s["id"]);
          const status = str(s["status"]) as DeliveryState;
          if (!id || !STATES.includes(status)) continue;
          out.push({
            kind: "status", dedupeKey: `status:${id}:${status}:${str(s["timestamp"])}`, messageId: id, status, recipient: str(s["recipient_id"]), timestamp: str(s["timestamp"]),
            errors: arr(s["errors"]).map(obj).map((e) => ({ code: Number(e["code"]) || 0, title: str(e["title"]) })),
          });
        }
      } else if (field === "message_template_status_update") {
        const name = str(value["message_template_name"]);
        out.push({ kind: "template", dedupeKey: `tpl:${name}:${str(value["event"])}:${str(value["message_template_id"])}`, template: name, event: str(value["event"]) });
      } else {
        out.push({ kind: "other", dedupeKey: `other:${field}:${JSON.stringify(value).length}:${str(obj(entry)["id"])}`, field });
      }
    }
  }
  return out;
}

/** Keeps only events not seen before (the backend uses a unique DB column instead of memory). */
export function dedupe(events: WebhookEvent[], seen: Set<string>): WebhookEvent[] {
  return events.filter((e) => (seen.has(e.dedupeKey) ? false : (seen.add(e.dedupeKey), true)));
}
