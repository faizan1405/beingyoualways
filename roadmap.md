# Roadmap — complete admin panel (final frontend phase)

- [x] Data layer: versioned demo store (local for non-personal, session for personal), services, export / import / reset.
- [x] Dashboard: live metrics, date filters, charts, status breakdown, top sellers.
- [x] Products: duplicate, filters, visibility, benefits, related products, 4-slide image manager, preview.
- [x] Orders: detail, 7 statuses, notes, timeline, print, CSV export, create demo order.
- [x] Customers: filters, computed totals, notes, status, addresses.
- [x] Customer stories: categories, photos, before/after, videos, placements, persistence.
- [x] WhatsApp campaigns (drafts only), abandoned cart timing + history, chatbot builder with preview.
- [x] Website content reflected on the storefront.
- [x] Discounts with calculation preview.
- [x] Store settings (no secrets).
- [x] Client approvals updated from entered information.
- [x] Admin demo sign-in + not-secure notice; API readiness module.
- [x] Tests, browser checks (desktop / tablet / phone).
- [ ] Waiting on client: shipping rates, COD rules, WhatsApp number + API, real reviews, Hostinger backend.
- [ ] Waiting on client: screenshot document for the "cactus" advert correction.

# Roadmap — WhatsApp Cloud API (Meta) via Hostinger

- [x] Meta IDs + API contracts (no token in the site); live status stays "pending" until the Hostinger backend answers.
- [x] Admin WhatsApp Connection dashboard: status, number, templates, messages, webhooks, automations, errors, test checklist.
- [x] OTP sign-in rules (expiry, resend, attempts, lockout); demo code only while no backend.
- [x] Order notification templates from real order data (order page preview).
- [x] Abandoned cart: consent, 6h, stop on checkout, no duplicates.
- [x] Campaigns: consent/opt-out, approved templates, variables, limits, delivery reports (none until real).
- [x] Chatbot: typed-message routing + human fallback.
- [x] Webhook verify/signature/dedupe helpers + backend spec doc; tests.
- [x] Superseded by Phase 4 below (real server implementation).

# Roadmap — Phase 1: production backend (Hostinger MySQL)

- [x] `server/`: Express + Prisma (MySQL) API — health, auth, public + admin products, validation, errors, logs, rate limits, CORS/CSRF, graceful shutdown.
- [x] Database schema + first migration (users/roles/sessions, catalogue, customers, orders, payments, discounts, reviews, WhatsApp consent, content, settings, activity log).
- [x] Catalogue seed (22 products: 20 visible, 2 hidden drafts) — no fake customers/orders/payments.
- [x] Real admin sign-in (Argon2id, httpOnly session cookie, lockout, roles) + console admin bootstrap / password reset.
- [x] Website switches to the API when `VITE_API_BASE_URL` is set: admin sign-in/out, product list/create/edit/prices/visibility/archive; other admin areas switched off.
- [x] Unit tests + real MySQL integration tests; browser end-to-end against a local API; Node (Hostinger) website build checked.
- [x] Deployment guide `server/README.md`.
- [ ] Blocked: Hostinger plan with Node.js apps, MySQL credentials, domains — deploy + verify on Hostinger (owner).
- [ ] Later phases: orders/checkout, Razorpay, COD, Google sign-in, WhatsApp OTP/notifications, cart reminders, media uploads, reviews, discounts, analytics.

# Roadmap — Phase 2: real e-commerce operations (Hostinger)

- [x] Database migration 2: stock reservations, order payment/fulfilment fields, order timeline, payment events, discount eligibility.
- [x] Server: settings (shipping, COD, store contact) in paise; public checkout config.
- [x] Server: bag validation + quote (database prices, stock, discounts) — never trusts browser prices.
- [x] Server: place order (guest), idempotent checkout key, stock reservation, discount redemption, COD orders.
- [x] Server: Razorpay orders, signature verification, webhook (raw body, dedupe, out-of-order), failure/cancel, retry, expiry + reconciliation.
- [x] Server: admin orders (filters, detail, timeline, notes, safe status changes, cancel + restock, shipment, COD collection, CSV), customers, dashboard, discounts, settings.
- [x] Real-database tests for the 20 end-to-end checks; existing tests still pass.
- [x] Website: bag + checkout use the server when connected (quote, COD, Razorpay Checkout, confirmation, errors); no simulated order in preview.
- [x] Website admin: orders, customers, dashboard, discounts, settings read/write the server when connected.
- [x] Production rules: no demo fallback or demo reset in production builds.
- [x] Hostinger docs: env template, Razorpay setup, webhook URL, backup/restore, deployment checklist.

Open (needs the client / Hostinger — cannot be done from here):
- [ ] Hostinger Node.js plan + MySQL database, deploy API and website, run migrations/seed/admin:create.
- [ ] Client confirms shipping fee, free-shipping threshold, delivery estimate and the COD decision; enter them in Admin → Settings.
- [ ] Stock counts for every orderable product.
- [ ] Razorpay test keys + webhook on the Hostinger domain; real test payments; then live keys after approval.

# Roadmap — Phase 3: real customer accounts, Google login & media (Hostinger)

- [x] Server: customer accounts — email/password sign-up + sign-in, Argon2id hashing, email verification, password recovery, httpOnly sessions, sign-out, rate limits, profile edit, saved addresses, order history, account deletion.
- [x] Server: Google sign-in — real OAuth (authorization code + PKCE), server-side verification, safe account linking, env-configured, honest "not configured" status.
- [x] Server: customer order access — signed-in order history, guest checkout still works, private order link reused for ownership-verified claiming of guest orders.
- [x] Server: media — upload product/gallery photos, testimonial photos/videos, thumbnails; type/size/content validation; WebP + thumbnails; video with seeking; MySQL metadata; no orphaned/unsafe deletes. (Hardened: uploads stream to disk, linked product/story verified, safe purge + public-visibility rules.)
- [x] Server: customer stories (reviews) + website content + client approvals read/write the real database; public stories only when verified + consented + published.
- [x] Website: real sign-in/register, account pages, admin media upload (product photos with progress, replace/reorder/archive), website content + customer stories + approvals admin screens on the server; storefront wording and stories read the server when connected.
- [x] Website: Google sign-in wired to the server's OAuth flow (redirect + callback handling); honest "not configured" state until credentials exist.
- [x] Remove remaining Lovable-hosted media (28 files, ~47 MB) — the real files now live in the project.
- [x] Account emails: confirm email, reset password, password changed/reset and account deleted notices (text + HTML, names escaped); exact Google + SMTP settings listed in `server/README.md` and `.env.example`.
- [x] Tests: real database integration tests + website suite; production build.
- [ ] Blocked: Google OAuth credentials, SMTP for verification emails, Hostinger deploy.

# Roadmap — Google sign-in + GitHub → Hostinger readiness

- [x] Google: `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` / `AUTH_SECRET` names (old names still read), startup validation (swapped values, exact callback path, https, AUTH_SECRET in production).
- [x] Google: signed 10-minute flow cookie, no re-pointing an account linked to another Google ID, every failure returns to the store's sign-in page with a clear reason.
- [x] Real-database tests of the store side of Google sign-in (stand-in Google signer); unit tests for token checks.
- [x] Media: absolute `MEDIA_ROOT` bug fixed (uploads had landed inside the app folder); production requires a folder outside the deploy folder; start-up write check.
- [x] Deploy: server lockfile repaired for `npm ci`; stray test uploads removed from Git; `.env` ignored; secrets audit clean (files + history).
- [x] Website: Node (Hostinger) build verified against a local API; honest "store can't be reached" page; live sign-in note no longer says "demo".
- [x] Docs: Hostinger GitHub deploy, migrations, media persistence/backups, Google Console settings.
- [ ] Blocked (owner): set the variables in hPanel, create MySQL + media folder, deploy, then one real Google sign-in on the live domain.
- [ ] Blocked (owner): SMTP mailbox; Razorpay test keys; shipping/COD confirmation.

# Roadmap — Phase 4: real WhatsApp Cloud API on the Hostinger server

- [x] Server: Meta Graph client (token only in the Authorization header), env validation, connection status + checks, template lookup/approval/variable checks.
- [x] Server: signed webhook (raw-body HMAC), durable inbox, duplicate protection, delivery statuses in order (incl. early arrivals), template/account/quality events.
- [x] Server: WhatsApp sign-in codes (hashed, expiry, single use, resend + hourly limits, lockout, no account enumeration).
- [x] Server: order updates from real orders with consent, once per step; "Out for delivery" action; retries + permanent failures; revoked-token pause.
- [x] Server: 6-hour bag reminder (consent, DB-priced, survives restarts, cancelled on order, one-time bag link).
- [x] Server: campaigns (drafts send nothing; owner approves the exact audience; opt-outs excluded; daily limits; reports from Meta only).
- [x] Server: chatbot from real records + human hand-off inbox; STOP opt-out.
- [x] Website: live admin screens (WhatsApp API, campaigns, bag reminders, chatbot, order WhatsApp panel), checkout consent boxes, bag-link restore, account WhatsApp choices, sign-in shows WhatsApp only when the server can send codes.
- [x] Tests: 30 WhatsApp database tests + unit tests (stand-in for Meta); full server and website suites.
- [ ] Blocked (owner): System User access token + App Secret on Hostinger, webhook verification on the live API domain, approved templates, a test number — then one real send/receive.
