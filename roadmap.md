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
