// Meta WhatsApp Business Cloud API configuration (identifiers only — not secrets).
// The access token, app secret and webhook verify token live ONLY in the Hostinger
// server environment. Nothing in this file may ever hold a token.

export const META_WHATSAPP = {
  appId: "1393915615725367",
  businessAccountId: "1150649830611813",
  phoneNumberId: "873369352531284",
  /** Graph API version the Hostinger backend should call; confirm it is still supported at deploy time. */
  graphApiVersion: "v25.0",
} as const;

/**
 * Flipped to true only after an authenticated server-side request from the Hostinger
 * backend has succeeded (token valid, number linked to this business account).
 * Never set by hand from the browser.
 */
export const WHATSAPP_TOKEN_VALIDATED = false;

/** Server environment variables the Hostinger backend needs (names only). */
export const WHATSAPP_SERVER_ENV = [
  { name: "WHATSAPP_ACCESS_TOKEN", note: "System-user access token from the owner (never in the website)." },
  { name: "WHATSAPP_APP_SECRET", note: "Meta app secret — used to check the X-Hub-Signature-256 header on webhooks." },
  { name: "WHATSAPP_VERIFY_TOKEN", note: "Any long random text; the same value goes into Meta → Webhooks → Verify token." },
  { name: "WHATSAPP_PHONE_NUMBER_ID", note: META_WHATSAPP.phoneNumberId },
  { name: "WHATSAPP_BUSINESS_ACCOUNT_ID", note: META_WHATSAPP.businessAccountId },
  { name: "META_GRAPH_API_VERSION", note: META_WHATSAPP.graphApiVersion },
] as const;
