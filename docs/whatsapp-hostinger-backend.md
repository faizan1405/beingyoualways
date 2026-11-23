# WhatsApp Cloud API — Hostinger backend handover

The website is frontend-only. **Every Meta request must come from the Hostinger server.**
The browser only calls the endpoints below on our own API (`HOSTINGER_API_BASE_URL` in
`src/services/api.ts`), with an httpOnly session cookie. No token ever reaches the browser.

## Meta configuration

| Item | Value |
|---|---|
| Facebook App ID | 1393915615725367 |
| WhatsApp Business Account ID | 1150649830611813 |
| Phone Number ID | 873369352531284 |
| Graph API version | v25.0 — confirm it is still supported when deploying |

## Server environment variables (never commit, never log)

- `WHATSAPP_ACCESS_TOKEN` — permanent System User token supplied by the owner
- `WHATSAPP_APP_SECRET` — for webhook signatures
- `WHATSAPP_VERIFY_TOKEN` — long random string, also entered in Meta
- `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `META_GRAPH_API_VERSION`

Required token permissions: `whatsapp_business_messaging`, `whatsapp_business_management`.

## Validate before marking "connected"

1. `GET /{version}/debug_token?input_token=…` (or `GET /me`) succeeds → token valid; read scopes.
2. `GET /{version}/{WABA_ID}/phone_numbers` contains `873369352531284` → number belongs to the account.
3. `GET /{version}/873369352531284?fields=display_phone_number,verified_name,quality_rating,code_verification_status,messaging_limit_tier` → registered.
4. `GET /{version}/{WABA_ID}/message_templates?fields=name,status,category,language` → templates readable.

Only after all four succeed may `/api/admin/whatsapp/status` return `state: "connected"`.

## Endpoints to build

| Method & path | Purpose |
|---|---|
| POST `/api/auth/whatsapp/request-otp` | `{ phone }` → create code, send `login_otp` template |
| POST `/api/auth/whatsapp/verify-otp` | `{ phone, code }` → check hash, set httpOnly session |
| GET `/api/admin/whatsapp/status` | `WhatsAppStatus` (see `src/services/whatsappCloudService.ts`) |
| GET `/api/admin/whatsapp/templates` | Templates with Meta status |
| GET `/api/admin/whatsapp/messages` | Sent / failed messages with webhook state |
| GET `/api/admin/whatsapp/errors` | Recent Meta errors (code + plain reason) |
| POST `/api/admin/whatsapp/tests` | `{ check, recipient }` — one authorized number, never bulk |
| POST `/api/admin/orders/:id/notify` | Order status template (also automatic on status change) |
| POST `/api/admin/whatsapp/campaigns/:id/schedule` | Admin action only; never automatic |
| GET/POST `/api/admin/whatsapp/opt-outs` | Consent, STOP handling |
| GET/POST `/api/whatsapp/webhook` | Meta webhook |

All `/api/admin/*` routes require a server-verified admin session.

## OTP rules (mirror of `OTP_POLICY` in `src/lib/whatsapp-cloud.ts`)

6 digits from a CSPRNG · stored hashed · expires in 5 min · resend after 60 s · max 3 codes per
number per hour · max 5 wrong attempts then 15-min lock · also rate-limit per IP · single use.
Template `login_otp` (AUTHENTICATION category, copy-code button).

## Webhook

- **GET**: if `hub.mode=subscribe` and `hub.verify_token === WHATSAPP_VERIFY_TOKEN` return `hub.challenge` (200), else 403.
- **POST**: read the raw body, check `X-Hub-Signature-256 = "sha256=" + HMAC_SHA256(app_secret, raw_body)` with a constant-time compare; 401 if wrong.
- Store each event in a table with a **unique** dedupe key before processing; duplicates are acknowledged and skipped.
- Status precedence: `sent` never overwrites `delivered`/`read`; `failed` keeps its `errors[]`. Store the provider timestamp.
- Reply 200 within a few seconds; process heavier work after storing.
- Reference code: `verifySubscription`, `verifySignature`, `parseWebhook`, `dedupe` in `src/lib/whatsapp-webhook.ts`; `mergeDeliveryState` in `src/lib/whatsapp-cloud.ts`.

### Meta → App → WhatsApp → Configuration

- Callback URL: `https://<hostinger-api-domain>/api/whatsapp/webhook`
- Verify token: the value of `WHATSAPP_VERIFY_TOKEN`
- Subscribe: `messages`, `message_template_status_update`, `account_update`, `phone_number_quality_update`
- The app must be subscribed to the WABA: `POST /{version}/{WABA_ID}/subscribed_apps`.

## Automations

- **Order updates**: confirmed / processing / shipped / delivered / cancelled → `order_*` templates (UTILITY), filled from the real order (`orderNotification`).
- **Abandoned cart**: job every few minutes; send `abandoned_cart_reminder` only when `reminderDecision(...) === "due"` (consent, 6 h, not checked out, not already reminded). Record the message id and result; unique index on cart id prevents duplicates.
- **Campaigns**: recipients = opted-in customers with a valid number (`campaignRecipients`); respect the messaging-limit tier; approved MARKETING templates only; never automatic.
- **Chatbot**: incoming `messages` webhook → `replyToText` with the saved chatbot config; order tracking only after matching the order's phone to the sender; anything unclear → human handoff.

## Integration test plan (authorized test number only)

Authentication · phone association · template retrieval · one test message · webhook handshake ·
tampered-signature rejection · delivery-status storage · error reporting · expired-token (190)
reporting · duplicate-event handling. No bulk sends, no production campaigns.
