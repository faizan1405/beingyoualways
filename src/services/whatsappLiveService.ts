// Admin + shopper calls to the store server's WhatsApp endpoints. Meta is only ever called by the
// server; nothing here holds or sees a token.
import { apiRequest, toQuery, withId } from "./api";

export type MessageState = "QUEUED" | "ACCEPTED" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "SKIPPED" | "RECEIVED";

export interface LiveStatus {
  configured: boolean;
  state: "not-validated" | "token-invalid" | "connected";
  appId: string | null; wabaId: string | null; phoneNumberId: string | null; graphVersion: string | null;
  displayPhoneNumber: string | null; verifiedName: string | null; qualityRating: string | null; messagingLimit: number | null;
  permissions: string[]; checkedAt: string | null; error: string | null;
  checks: { key: string; label: string; ok: boolean | null; detail: string }[];
  webhook: { lastVerifiedAt: string | null; lastEventAt: string | null; lastSignatureFailureAt: string | null; subscribed: boolean | null };
  accountBlocked: { event: string; at: string } | null;
  quality: { event: string; currentLimit: string | null; at: string } | null;
  templateEvents: { name: string; event: string; reason: string | null; at: string }[];
  templates: { total: number; approved: number };
}
export interface PurposeRow { purpose: string; label: string; category: string; variables: string[]; suggested: string; template: { name: string; language: string }; ready: boolean; reason: string | null }
export interface MetaTemplateRow { name: string; language: string; status: string; category: string; variables: number; hasLinkButton: boolean }
export interface Automations { otp: boolean; orderUpdates: boolean; abandonedCart: boolean; chatbot: boolean; marketingDailyLimit: number }
export interface LiveMessage {
  id: string; direction: "OUTBOUND" | "INBOUND"; kind: string; purpose: string | null; label: string | null; to: string; templateName: string | null; state: MessageState;
  attempts: number; nextAttemptAt: string | null; errorCode: number | null; error: string | null; text: string | null; orderId: string | null; campaignId: string | null;
  needsHuman: boolean; handledAt: string | null; at: string; acceptedAt: string | null; sentAt: string | null; deliveredAt: string | null; readAt: string | null; failedAt: string | null;
}
export interface ApiErrorRow { id: string; at: string; operation: string; httpStatus: number | null; code: number | null; subcode: number | null; message: string; detail: string | null; traceId: string | null }
export interface CheckResult { key: string; passed: boolean; detail: string; at: string }
export interface ConsentRow { id: string; phone: string; purpose: string; status: "OPTED_IN" | "OPTED_OUT"; source: string; at: string }
export interface CartRow {
  id: string; name: string; phone: string; items: number; subtotalPaise: number; status: "OPEN" | "CONVERTED" | "REMINDED" | "SKIPPED" | "EXPIRED";
  lastActivityAt: string; remindAt: string; remindedAt: string | null; recoveredAt: string | null; orderId: string | null; note: string | null; message: { state: MessageState; error: string | null } | null;
}
export type Segment = { kind: "all_opted_in" } | { kind: "has_ordered" } | { kind: "no_order_days"; days: number } | { kind: "bought_category"; category: string };
export interface CampaignInput { name: string; templateName: string; language: string; segment: Segment; params: string[]; scheduledAt: string | null; maxRecipients: number }
export interface Campaign extends CampaignInput {
  id: string; status: "DRAFT" | "APPROVED" | "COMPLETED" | "CANCELLED"; recipientCount: number | null; approvedAt: string | null; cancelledAt: string | null; completedAt: string | null; createdAt: string;
  report: { queued: number; accepted: number; sent: number; delivered: number; read: number; failed: number; skipped: number };
}
export interface CampaignDetail {
  campaign: Campaign;
  audience: { eligible: number; optedIn: number; optedOut: number; blocked: number; notInSegment: number } | null;
  sample: { phone: string; name: string }[];
  failures: { phone: string; state: string; errorCode: number | null; errorTitle: string | null }[];
}
export interface ChatbotSettings { greeting: string; handoffText: string; supportHours: string }
export interface InboxThread { phone: string; key: string; canReply: boolean; messages: LiveMessage[] }

const W = "/api/admin/whatsapp";
const send = <T,>(path: string, method: "POST" | "PUT" | "PATCH", body: unknown) => apiRequest<T>(path, { method, body });

export const whatsappLive = {
  status: (refresh = false) => apiRequest<LiveStatus>(`${W}/status${refresh ? "?refresh=1" : ""}`),
  templates: () => apiRequest<{ purposes: PurposeRow[]; templates: MetaTemplateRow[]; error: string | null }>(`${W}/templates`),
  saveTemplates: (map: Record<string, { name: string; language: string }>) => send<{ map: Record<string, { name: string; language: string }> }>(`${W}/templates`, "PUT", map),
  automations: () => apiRequest<{ automations: Automations }>(`${W}/automations`).then((r) => r.automations),
  saveAutomations: (a: Automations) => send<{ automations: Automations }>(`${W}/automations`, "PUT", a).then((r) => r.automations),
  messages: (q: { kind?: string; state?: string; phone?: string; page?: number }) => apiRequest<{ messages: LiveMessage[]; total: number; page: number; last30Days: Partial<Record<MessageState, number>> }>(`${W}/messages${toQuery(q)}`),
  errors: () => apiRequest<{ errors: ApiErrorRow[] }>(`${W}/errors`).then((r) => r.errors),
  runCheck: (check: string, recipient: string) => send<CheckResult>(`${W}/tests`, "POST", { check, recipient }),
  consents: (phone?: string) => apiRequest<{ summary: { marketing: { optedIn: number; optedOut: number }; orderUpdates: { optedIn: number; optedOut: number } }; history: ConsentRow[] }>(`${W}/opt-outs${toQuery({ phone })}`),
  setConsent: (b: { phone: string; purpose: "marketing" | "order_updates"; status: "OPTED_IN" | "OPTED_OUT"; note: string }) => send<{ changed: boolean }>(`${W}/opt-outs`, "POST", b),
  carts: (status?: string) => apiRequest<{ carts: CartRow[]; total: number; counts: Record<string, number> }>(`${W}/carts${toQuery({ status })}`),
  campaigns: () => apiRequest<{ campaigns: Campaign[] }>(`${W}/campaigns`).then((r) => r.campaigns),
  campaign: (id: string) => apiRequest<CampaignDetail>(`${W}/campaigns/${encodeURIComponent(id)}`),
  createCampaign: (c: CampaignInput) => send<{ campaign: Campaign }>(`${W}/campaigns`, "POST", c).then((r) => r.campaign),
  updateCampaign: (id: string, c: CampaignInput) => send<{ campaign: Campaign }>(`${W}/campaigns/${encodeURIComponent(id)}`, "PATCH", c).then((r) => r.campaign),
  approveCampaign: (id: string, confirmRecipients: number) => send<{ campaign: Campaign }>(`${W}/campaigns/${encodeURIComponent(id)}/approve`, "POST", { confirmRecipients }).then((r) => r.campaign),
  cancelCampaign: (id: string) => send<{ campaign: Campaign }>(`${W}/campaigns/${encodeURIComponent(id)}/cancel`, "POST", {}).then((r) => r.campaign),
  chatbot: () => apiRequest<{ chatbot: ChatbotSettings }>(`${W}/chatbot`).then((r) => r.chatbot),
  saveChatbot: (c: ChatbotSettings) => send<{ chatbot: ChatbotSettings }>(`${W}/chatbot`, "PUT", c).then((r) => r.chatbot),
  inbox: () => apiRequest<{ threads: InboxThread[] }>(`${W}/inbox`).then((r) => r.threads),
  resolve: (id: string) => send<{ resolved: boolean }>(`${W}/inbox/${encodeURIComponent(id)}/resolve`, "POST", {}),
  reply: (id: string, text: string) => send<{ sent: boolean }>(`${W}/inbox/${encodeURIComponent(id)}/reply`, "POST", { text }),
  // order screen
  orderMessages: (orderId: string) => apiRequest<{ messages: LiveMessage[] }>(withId("/api/admin/orders/:id/whatsapp", orderId)).then((r) => r.messages),
  retryOrderMessage: (orderId: string, purpose: string) => send<{ queued: boolean }>(withId("/api/admin/orders/:id/notify", orderId), "POST", { purpose }),
};

export interface BagReminderStatus {
  /** the store has bag reminders switched on and WhatsApp connected */
  available: boolean;
  /** signed in with a mobile number proved by a WhatsApp code */
  eligible: boolean;
  /** masked number the reminder would go to */
  phone: string | null;
  reason: "off" | "sign_in" | "verify_phone" | null;
  /** a reminder is currently scheduled for this shopper */
  on: boolean;
}

/** Shopper side: sign-in availability, bag reminders, own preferences. */
export const whatsappShop = {
  otpAvailability: () => apiRequest<{ available: boolean; reason: string | null }>("/api/auth/whatsapp/status"),
  checkoutStarted: (b: { checkoutKey: string; lines: { productId: string; variantId: string; quantity: number }[]; contact: { name: string; phone: string }; reminderConsent: boolean }) =>
    send<{ tracking: boolean }>("/api/checkout/reminders/started", "POST", b),
  /** Bag-page reminder: offered only to a shopper signed in with a WhatsApp-verified number. */
  bagReminderStatus: () => apiRequest<BagReminderStatus>("/api/checkout/reminders/bag"),
  saveBagReminder: (b: { checkoutKey: string; lines: { productId: string; variantId: string; quantity: number }[]; reminderConsent: boolean }) =>
    send<{ tracking: boolean; remindAt?: string }>("/api/checkout/reminders/bag", "POST", b),
  recoverBag: (token: string) => send<{ lines: { productId: string; variantId: string; quantity: number }[] }>("/api/checkout/reminders/recover", "POST", { token }),
  preferences: () => apiRequest<{ orderUpdates: boolean; offers: boolean }>("/api/customer/whatsapp"),
  savePreferences: (p: { orderUpdates: boolean; offers: boolean }) => send<{ orderUpdates: boolean; offers: boolean }>("/api/customer/whatsapp", "PUT", p),
};

export const STATE_TEXT: Record<MessageState, string> = {
  QUEUED: "Waiting to send", ACCEPTED: "Accepted by Meta", SENT: "Sent", DELIVERED: "Delivered", READ: "Read", FAILED: "Failed", SKIPPED: "Not sent", RECEIVED: "Received",
};
