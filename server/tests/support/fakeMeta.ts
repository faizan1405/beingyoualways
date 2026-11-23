// Test double for Meta's Graph API (WhatsApp Cloud API). No network. Errors are raised as the same
// MetaApiError the real client produces, so retry / token / failure handling runs for real.
import type { MetaTemplate } from "../../src/lib/whatsapp.js";
import { MetaApiError, type GraphClient } from "../../src/services/whatsappGraph.js";

export const WA = { appId: "1393915615725367", wabaId: "1150649830611813", phoneNumberId: "873369352531284" };
export const WA_ENV = {
  WHATSAPP_APP_ID: WA.appId, WHATSAPP_WABA_ID: WA.wabaId, WHATSAPP_PHONE_NUMBER_ID: WA.phoneNumberId,
  WHATSAPP_ACCESS_TOKEN: `EAAtest${"x".repeat(60)}`, WHATSAPP_APP_SECRET: "0123456789abcdef0123456789abcdef",
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: "verify-token-for-tests-1234567890", WHATSAPP_GRAPH_API_VERSION: "v25.0",
  WHATSAPP_TEST_RECIPIENTS: "9876500001",
};

const body = (text: string) => ({ type: "BODY", text });
export const tpl = (name: string, category: string, text: string, extra: Partial<MetaTemplate> = {}): MetaTemplate =>
  ({ name, language: "en", status: "APPROVED", category, components: [body(text)], ...extra });

export const STANDARD_TEMPLATES: MetaTemplate[] = [
  { name: "login_otp", language: "en", status: "APPROVED", category: "AUTHENTICATION", components: [body("*{{1}}* is your verification code."), { type: "BUTTONS", buttons: [{ type: "URL", text: "Copy code", url: "https://www.whatsapp.com/otp/code/?otp_type=COPY_CODE&code=otp{{1}}" }] }] },
  tpl("order_confirmation", "UTILITY", "Hi {{1}}, your order {{2}} for {{3}} is confirmed."),
  tpl("payment_confirmation", "UTILITY", "Hi {{1}}, we received {{2}} for order {{3}}."),
  tpl("cod_order_confirmation", "UTILITY", "Hi {{1}}, thank you for order {{2}}. Please keep {{3}} ready."),
  tpl("order_packed", "UTILITY", "Hi {{1}}, order {{2}} is packed."),
  tpl("order_shipped", "UTILITY", "Hi {{1}}, order {{2}} has shipped: {{3}}"),
  tpl("order_out_for_delivery", "UTILITY", "Hi {{1}}, order {{2}} is out for delivery."),
  tpl("order_delivered", "UTILITY", "Hi {{1}}, order {{2}} was delivered."),
  tpl("order_cancelled", "UTILITY", "Hi {{1}}, order {{2}} was cancelled."),
  tpl("abandoned_cart_reminder", "MARKETING", "Hi {{1}}, your bag is waiting: {{2}} Reply STOP to opt out."),
  tpl("new_launch", "MARKETING", "Hi {{1}}, something new has arrived: {{2}} Reply STOP to opt out."),
  { ...tpl("hello_world", "UTILITY", "Hello World"), language: "en_US" },
];

export function createFakeMeta() {
  let n = 0;
  const sent: { to: string; type: string; template?: { name: string; language: { code: string }; components?: { type: string; parameters: { text: string }[] }[] }; text?: { body: string } }[] = [];
  const state = { templates: [...STANDARD_TEMPLATES], tokenRevoked: false, failures: [] as { httpStatus: number; code: number; title: string }[], calls: 0 };
  const err = (op: string, httpStatus: number, code: number, title: string) => new MetaApiError(op, httpStatus, code, null, title, null, "FAKE-TRACE");
  const guard = (op: string) => {
    state.calls++;
    if (state.tokenRevoked) throw err(op, 401, 190, "Error validating access token: The session has been invalidated.");
  };
  const graph: GraphClient = {
    async get<T>(op: string, path: string) {
      guard(op);
      if (path === WA.phoneNumberId) return { id: WA.phoneNumberId, display_phone_number: "+91 90000 00000", verified_name: "Being You Always", quality_rating: "GREEN", messaging_limit_tier: "TIER_1K", code_verification_status: "VERIFIED" } as T;
      if (path === `${WA.wabaId}/phone_numbers`) return { data: [{ id: WA.phoneNumberId, display_phone_number: "+91 90000 00000" }] } as T;
      if (path === `${WA.wabaId}/message_templates`) return { data: state.templates } as T;
      if (path === `${WA.wabaId}/subscribed_apps`) return { data: [{ whatsapp_business_api_data: { id: WA.appId, name: "BYA" } }] } as T;
      throw err(op, 400, 100, `Unknown path ${path}`);
    },
    async post<T>(op: string, path: string, b: unknown) {
      guard(op);
      if (path !== `${WA.phoneNumberId}/messages`) throw err(op, 400, 100, "Unknown path");
      const f = state.failures.shift();
      if (f) throw err(op, f.httpStatus, f.code, f.title);
      sent.push(b as (typeof sent)[number]);
      return { messaging_product: "whatsapp", messages: [{ id: `wamid.FAKE${String(++n).padStart(6, "0")}` }] } as T;
    },
  };
  return {
    graph, sent, state,
    nextId: () => `wamid.FAKE${String(n + 1).padStart(6, "0")}`,
    reset() { sent.length = 0; state.failures.length = 0; state.tokenRevoked = false; state.templates = [...STANDARD_TEMPLATES]; },
    bodyParams: (i: number) => sent[i]?.template?.components?.find((c) => c.type === "body")?.parameters.map((p) => p.text) ?? [],
    last: () => sent[sent.length - 1],
  };
}
