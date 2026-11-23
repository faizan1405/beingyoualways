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
- [ ] Blocked: Hostinger backend, owner's access token, Meta template approval, authorized test number.

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
