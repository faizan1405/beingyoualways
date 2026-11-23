// WhatsApp Cloud API — frontend contract for the Hostinger backend.
// The browser never talks to graph.facebook.com and never sees the access token:
// each function calls our own backend, which calls Meta with the server-side token.
// Until HOSTINGER_API_BASE_URL is set every call reports "backend not connected".
import { META_WHATSAPP, WHATSAPP_TOKEN_VALIDATED } from "@/config/whatsapp";
import type { DeliveryState, TemplateCategory, TemplateStatus } from "@/lib/whatsapp-cloud";
import { API_ENDPOINTS, BackendNotConnectedError, apiRequest, isBackendConfigured } from "./api";

export type ConnectionState = "backend-missing" | "not-validated" | "token-invalid" | "connected";

export interface WhatsAppStatus {
  state: ConnectionState;
  /** From Meta (GET /{phone-number-id}) — null until read by the backend. */
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
  messagingLimit: number | null;
  permissions: string[];
  checkedAt: string | null;
  error: string | null;
}

export interface TemplateRecord { name: string; category: TemplateCategory; language: string; status: TemplateStatus }
export interface MessageRecord { id: string; to: string; template: string | null; state: DeliveryState; at: string; error?: string | undefined; source: "order" | "otp" | "cart" | "campaign" | "chatbot" | "test" }
export interface ApiErrorRecord { at: string; code: number; message: string; context: string }

export const INTEGRATION_CHECKS = [
  { key: "auth", label: "API authentication (token accepted by Meta)" },
  { key: "phone", label: `Phone number ${META_WHATSAPP.phoneNumberId} belongs to business account ${META_WHATSAPP.businessAccountId}` },
  { key: "templates", label: "Approved templates can be read" },
  { key: "test-message", label: "Test message to one authorized number is accepted" },
  { key: "webhook-verify", label: "Webhook handshake (verify token) succeeds" },
  { key: "webhook-signature", label: "Webhook signature check rejects a tampered body" },
  { key: "status", label: "Delivery / read status is stored from the webhook" },
  { key: "errors", label: "Errors from Meta are shown with a clear reason" },
  { key: "token-expired", label: "An expired / invalid token is reported (error 190), not hidden" },
  { key: "duplicates", label: "A repeated webhook event is processed only once" },
] as const;
export type IntegrationCheck = (typeof INTEGRATION_CHECKS)[number]["key"];
export interface CheckResult { key: IntegrationCheck; passed: boolean; detail: string; at: string }

/** Status shown when the backend can't be asked (honest default — never "connected"). */
export const offlineStatus = (): WhatsAppStatus => ({
  state: isBackendConfigured() ? (WHATSAPP_TOKEN_VALIDATED ? "connected" : "not-validated") : "backend-missing",
  displayPhoneNumber: null, verifiedName: null, qualityRating: null, messagingLimit: null, permissions: [], checkedAt: null,
  error: isBackendConfigured() ? null : "The Hostinger backend is not connected yet, so Meta has not been contacted.",
});

const guard = () => { if (!isBackendConfigured()) throw new BackendNotConnectedError(); };

export const whatsappCloudService = {
  config: META_WHATSAPP,
  status: async (): Promise<WhatsAppStatus> => { if (!isBackendConfigured()) return offlineStatus(); return apiRequest<WhatsAppStatus>(API_ENDPOINTS.waStatus); },
  templates: async () => { guard(); return apiRequest<TemplateRecord[]>(API_ENDPOINTS.waTemplates); },
  messages: async () => { guard(); return apiRequest<MessageRecord[]>(API_ENDPOINTS.waMessages); },
  errors: async () => { guard(); return apiRequest<ApiErrorRecord[]>(API_ENDPOINTS.waErrors); },
  /** One check against one explicitly authorized recipient. Never bulk. */
  runCheck: async (key: IntegrationCheck, recipient: string) => { guard(); return apiRequest<CheckResult>(API_ENDPOINTS.waTest, { method: "POST", body: { check: key, recipient } }); },
  notifyOrder: async (orderId: string) => { guard(); return apiRequest<MessageRecord>(API_ENDPOINTS.waOrderNotify.replace(":id", encodeURIComponent(orderId)), { method: "POST" }); },
};
