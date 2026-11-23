# Being You – Always — API server (Phases 1–3)

Express + TypeScript + Prisma on **Hostinger MySQL/MariaDB**. Serves the product catalogue, real
checkout (Cash on Delivery + Razorpay), private order-status pages, and the admin: sign-in, products,
orders, customers, discounts, store settings and the sales dashboard.

| | |
|---|---|
| Runtime | Node.js 20 or 22 (Hostinger Node.js app) |
| Database | Hostinger MySQL 8 / MariaDB 10.6+ (`utf8mb4`) |
| Passwords | Argon2id (19 MiB, t=2) |
| Sessions | Random 256-bit token in an `HttpOnly` cookie; only its SHA-256 hash is stored (`Session` table) |

## Endpoints (Phase 1 — implemented and tested)

| Method | Path | Access |
|---|---|---|
| GET | `/api/health` | public — `200 {database:"ok"}` or `503` when MySQL is unreachable |
| GET | `/api/health/live` | public — process only |
| POST | `/api/auth/login` | public, rate-limited (20/15 min per IP) + 5-try / 15-minute account lock |
| POST | `/api/auth/logout` | ends the session on the server |
| GET | `/api/auth/me` | signed-in admin |
| GET | `/api/products`, `/api/products/:idOrSlug` | public — visible products only, no stock counts |
| GET | `/api/categories` | public |
| GET | `/api/admin/products`, `/api/admin/products/:id` | `products.read` |
| POST | `/api/admin/products` | `products.write` |
| PATCH | `/api/admin/products/:id` | `products.write` (partial updates; sizes/shades and photos replaced when sent) |
| DELETE | `/api/admin/products/:id` | `products.delete` — archives; `?permanent=true` only for hidden, never-ordered products |

Writes must be JSON from an allowed origin (`CORS_ORIGINS`) — this is the cross-site request protection.
Every product change is written to `AdminActivityLog` (e.g. "30 ml ₹680 → ₹695").

Roles: **owner** (everything), **admin** (products, later orders/content), **staff** (view products).

## Endpoints (Phase 2 — checkout and store operations)

All money is integer **paise**; the server recalculates every price, discount, shipping and COD charge
from the database — the browser's totals are never trusted.

| Method | Path | Access |
|---|---|---|
| GET | `/api/checkout/config` | public — which payment methods are switched on (no secrets, no PIN lists) |
| POST | `/api/checkout/quote` (alias `/cart`) | public, rate-limited — server-priced bag: stock, discount, shipping, COD charge, `canPlaceOrder` |
| POST | `/api/checkout/orders` | public, rate-limited (40/15 min per IP) — places the order; `checkoutKey` makes repeat clicks return the same order |
| POST | `/api/checkout/orders/lookup` | order number + private token → order status page data |
| POST | `/api/checkout/orders/retry-payment` | re-opens payment for an unpaid online order |
| POST | `/api/checkout/razorpay/verify` | checks Razorpay's signature **and** fetches the payment from Razorpay before marking paid |
| POST | `/api/checkout/razorpay/problem` | logs a shopper-side payment failure (never changes status) |
| POST | `/api/webhooks/razorpay` | Razorpay webhook — HMAC signature on the raw body, each event processed once |
| GET | `/api/admin/dashboard` | `orders.read` — paid revenue (by payment date, India time), COD to collect, top products |
| GET | `/api/admin/orders`, `/orders/:id`, `/orders/export.csv` | `orders.read` |
| POST | `/api/admin/orders/:id/status` · `/notes` · `/shipment` | `orders.write` — only allowed status steps; every change is in the order timeline |
| POST | `/api/admin/orders/:id/cancel` | `orders.cancel` — releases or restocks items |
| POST | `/api/admin/orders/:id/cod-collected` | `payments.record` — full amount + reference only |
| POST | `/api/admin/payments/reconcile` | `orders.write` — re-checks unpaid online orders with Razorpay, releases expired holds |
| GET / PATCH | `/api/admin/customers`, `/customers/:id` | `customers.read` / `customers.write` |
| GET / POST / PATCH / DELETE | `/api/admin/discounts[/:id]` | `discounts.write` for changes |
| GET / PUT | `/api/admin/settings`, `/settings/:kind` (`shipping`, `cod`, `payments`, `store`) | `settings.write` for changes |

Rules enforced on the server:
- **No orders until the owner sets shipping** in Admin → Settings (fee, free-shipping threshold, delivery
  estimate). COD is off until switched on with its charge and limits. Nothing is pre-filled.
- **Stock**: a product without a counted stock figure can't be ordered. COD orders deduct stock at once;
  online orders hold it for `PAYMENT_HOLD_MINUTES` and release it if unpaid. Cancelling restocks.
- **Paid** only after Razorpay's signature check + payment fetch (or a verified webhook). Amount or
  currency mismatches are refused and logged. COD counts as revenue only once cash is recorded.
- **Test orders** (`STORE_TEST_MODE=true` or `rzp_test_` keys) are labelled and excluded from sales.
- Order-status links are `/order/<number>#t=<token>` (HMAC of the order number with `ORDER_LINK_SECRET`).

## Tables (migration `prisma/migrations/*_init`)
User, Role, Permission, RolePermission, UserRole, Session, PasswordResetToken, Category, Product,
ProductVariant, Inventory, ProductImage, Customer, ShippingAddress, Order, OrderItem, Payment, Discount,
Review, WhatsAppConsent, SiteContent, StoreSetting, AdminActivityLog.
Phase 2 migration (`*_phase2_commerce`) adds order/payment statuses, stock holds (`InventoryReservation`),
`OrderEvent`, `PaymentEvent`, shipping/tracking and discount rules. Reviews, WhatsApp consent and site
content tables are ready for later phases.

## Local development
```bash
cd server
cp .env.example .env            # set DATABASE_URL to a local MySQL/MariaDB, NODE_ENV=development, CORS_ORIGINS=http://localhost:8080
npm install
npx prisma migrate deploy
npm run db:seed
npm run admin:create:dev -- --email you@example.com --name "Your Name"
npm run dev
```
Website: set `VITE_API_BASE_URL=http://localhost:4000` when running the website locally.

## Tests
```bash
npm test                                                     # unit tests (no database)
TEST_DATABASE_URL="mysql://user:pass@127.0.0.1:3306/bya_test" npm run test:db   # REAL MySQL tests
```
`test:db` resets the database with the real migrations (the database name must contain `test`), imports the
catalogue, creates admin accounts and calls the HTTP API: login/invalid login/lockout/logout, protected
routes, create → re-read through a new connection, price change → public price, hide → removed from shop,
CSRF/origin checks and no credential leaks when the database is down.

---

# Deploying on Hostinger (GitHub → Hostinger)

Needs a Hostinger plan with **Node.js web apps** (Business / Cloud, or a VPS). Both apps deploy from this
one GitHub repository and redeploy automatically on every push to the chosen branch:

| App | Folder | Domain | Build | Start |
|---|---|---|---|---|
| API | `server` | `api.beingyoualways.com` | `npm ci && npm run build` | `npm start` (`node dist/src/index.js`) |
| Website | repository root | `beingyoualways.com` (+ `www` only if used) | `npm install && NITRO_PRESET=node-server npm run build` | `node .output/server/index.mjs` |

Same site (`*.beingyoualways.com`) → keep `COOKIE_SAMESITE=lax` and set `COOKIE_DOMAIN=.beingyoualways.com`.
Node 20 or 22 for both.

## 1. Database (once)
hPanel → **Databases → MySQL Databases**: create a database + user. Note host, name, user, password.
Build `DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/NAME"` (URL-encode special characters in the password).

## 2. Media folder (once) — survives every redeploy
GitHub redeploys replace the app folder, so uploads must live **outside** it. Over SSH / File Manager:
```bash
mkdir -p ~/bya-media && chmod 750 ~/bya-media     # owned by the hosting user the Node app runs as
```
Set `MEDIA_ROOT=/home/<your-hostinger-user>/bya-media` (absolute). In production the server refuses to start
if `MEDIA_ROOT` is relative, inside the deploy folder, or not writable — the message says which.
The email outbox (`MEDIA_ROOT/outbox`) lives there too.

## 3. API app
hPanel → **Websites → Add website → Node.js app → Import Git repository** → pick the repo and branch.
- Application root / directory: `server` · Node 20/22 · Build: `npm ci && npm run build` · Start: `npm start`
- Environment variables (hPanel, never in Git) — every name in `.env.example`. At minimum:
  `NODE_ENV=production`, `DATABASE_URL`, `CORS_ORIGINS=https://beingyoualways.com,https://www.beingyoualways.com`
  (drop `www` if unused), `PUBLIC_SITE_URL=https://beingyoualways.com`, `COOKIE_DOMAIN=.beingyoualways.com`,
  `ORDER_LINK_SECRET`, `MEDIA_ROOT`, plus the Google, email and Razorpay groups below when you switch them on.
- Domain: attach `api.beingyoualways.com`, enable SSL (HTTPS is required: cookies are `Secure` in production).

First deploy only, from the app's SSH terminal in the `server` folder:
```bash
npm run db:migrate          # prisma migrate deploy — applies pending migrations, never resets or drops the database
npm run db:seed:prod        # roles + categories + catalogue (never duplicates or overwrites)
npm run admin:create -- --email owner@beingyoualways.com --name "Store Owner"   # prompts for the password
```
Later deploys that add a migration: back up (see below), then `npm run db:migrate`, then restart.
(Alternative: Start command `npm run start:migrate` applies pending migrations on every start.)
**Never** run `prisma migrate dev`, `migrate reset` or `db push` against production.

Check: `https://api.beingyoualways.com/api/health` → `{"status":"ok","database":"ok"}` (503 + `database: unreachable` if MySQL is down).
The start-up log line shows `env`, `google: on|off`, `mail: smtp|outbox` and `razorpay: test|live|off`.

## 4. Website app
Add a second Node.js app from the same repository:
- Application root: repository root · Node 20/22
- Build: `npm install && NITRO_PRESET=node-server npm run build` · Start: `node .output/server/index.mjs`
  (`NITRO_PRESET=node-server` turns the build into a plain Node server; it's ignored inside Lovable's own preview.)
- Environment (needed **at build time**): `VITE_API_BASE_URL=https://api.beingyoualways.com`.
  Without it a production build has no demo data and no admin — always set it.
- Domain: `beingyoualways.com` (+ `www` redirect if used), SSL on.

If the API is down the website says so ("The store can't be reached right now") instead of showing stale or demo data.
All product photos and customer media shipped with the site are real files in the repository; photos uploaded
later from the admin live in `MEDIA_ROOT` and in MySQL.

## Secrets
- Real values live only in hPanel environment variables (or a local `server/.env`, which is git-ignored).
  `.env.example` holds names and placeholders only.
- Repository audit (Nov 2026): no credentials found in tracked files or in Git history (Google, Razorpay, SMTP,
  database URLs, private keys) — only obviously fake test values. No history clean-up is needed.
- If a real secret is ever committed: rotate it at the provider first, then remove it from history.

## Admin accounts and recovery
- There is no public sign-up. The first account is created with `admin:create` (must be the owner).
  More accounts: `npm run admin:create -- --email x --name y --role admin --allow-additional`.
- Forgotten password: `npm run admin:reset-password -- --email owner@beingyoualways.com` — sets a new
  password, clears the lock and signs that account out everywhere. Admins have no emailed reset link;
  shoppers do (see "Account emails" below).
- Passwords: at least 12 characters; common/guessable passwords are refused.

## Backups and recovery
- Back up **both** the database and the `MEDIA_ROOT` folder (they belong together).
- hPanel → **Databases → phpMyAdmin → Export** (or Hostinger's automatic backups). Before every deploy
  that adds a migration: `mysqldump --single-transaction -h HOST -u USER -p NAME > bya-$(date +%F).sql`.
- Restore: import the dump into an empty database, point `DATABASE_URL` at it, run `npm run db:migrate`.
- Migrations are forward-only; never run `prisma migrate dev` or `migrate reset` on production.

## Restarting and troubleshooting
- Restart from hPanel (Node.js app → Restart). The server shuts down gracefully on SIGTERM.
- Logs are one JSON line per request (`requestId`, path, status, ms); passwords, tokens, cookies and
  connection strings are redacted. Error responses include the `requestId` to find the log line.
- `Invalid server configuration — …` at start: a variable is missing or malformed (the message names it).
- `/api/health` → 503 `database: unreachable`: wrong `DATABASE_URL`, database user without access, or
  MySQL host not reachable from the app.
- Admin sign-in works but `/admin` returns to the sign-in page: the cookie isn't sent — check
  `CORS_ORIGINS` exactly matches the website origin, HTTPS on both, and `COOKIE_DOMAIN`.
- "Too many sign-in attempts": wait 15 minutes or use `admin:reset-password`.
- Prisma "query engine library not found": run `npm run build` on the server itself (it runs `prisma generate`
  for the server's OS).

## Razorpay setup (do this with **test keys first**)
1. Razorpay Dashboard → Account & Settings → API Keys → generate **Test** keys. Set `RAZORPAY_KEY_ID=rzp_test_…`
   and `RAZORPAY_KEY_SECRET` in the API app's environment variables (never in the website).
2. Webhooks → add `https://api.beingyoualways.com/api/webhooks/razorpay`, choose a strong secret →
   `RAZORPAY_WEBHOOK_SECRET`. Events: `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid` (refunds are handled in the Razorpay Dashboard for now).
3. Restart the API, switch on "Pay online" in Admin → Settings → Payments, and place a few test orders
   (success, failure, closing the window). They are labelled **Test** and never counted as sales.
4. Only after the client approves: swap to `rzp_live_…` keys (allowed only with `NODE_ENV=production`)
   and a live webhook secret. The server refuses live keys outside production and test keys are flagged.
5. Run "Re-check payments" in Admin → Orders after any outage; the webhook also catches late payments.

## Before taking real orders (checklist)
- [ ] `ORDER_LINK_SECRET` set (32+ random characters; changing it breaks old order links).
- [ ] Admin → Settings: shipping fee, free-shipping threshold and delivery estimate confirmed by the client.
- [ ] COD decision (on/off, charge, limits, PIN codes) confirmed by the client.
- [ ] Stock counts entered for every product that should be orderable.
- [ ] Razorpay test orders pass end-to-end on the Hostinger domain; then live keys.

## Google sign-in
How it works: the website sends the shopper to `/api/auth/google/start`; the API redirects to Google
(authorization code + PKCE, fresh `state` and `nonce`, held in a 10-minute HttpOnly cookie signed with
`AUTH_SECRET`); Google returns to `/api/auth/google/callback`; the API swaps the code server-to-server, verifies
the ID token (Google's signing keys, issuer, audience, expiry, nonce, confirmed email), creates or finds the
shopper in MySQL, sets the shopper session cookie and sends the browser back to `PUBLIC_SITE_URL/login` — never
to an address taken from the request. Shopper sessions can't open anything under `/api/admin`.
Account linking: a returning Google ID signs into its account; a confirmed password account with the same
email gets Google added; an unconfirmed password account is never taken over; an account tied to a different
Google ID is never re-pointed.

Google Cloud Console → APIs & Services:
1. **OAuth consent screen**: app name "Being You – Always", support email, home page
   `https://beingyoualways.com`, privacy policy `https://beingyoualways.com/privacy-policy`, scopes
   `openid`, `email`, `profile`; authorised domain `beingyoualways.com`. Publish (or add test users first).
2. **Credentials → OAuth client ID → Web application**:
   - Authorised redirect URI (exactly): `https://api.beingyoualways.com/api/auth/google/callback`
   - Authorised JavaScript origins: not used by this flow (everything runs server-side); adding
     `https://beingyoualways.com` (and `https://www.beingyoualways.com` if used) is harmless.
3. API app environment: `AUTH_GOOGLE_ID` (the `…apps.googleusercontent.com` client ID), `AUTH_GOOGLE_SECRET`,
   `GOOGLE_REDIRECT_URL=https://api.beingyoualways.com/api/auth/google/callback`, `AUTH_SECRET` (48 random
   characters), `PUBLIC_SITE_URL=https://beingyoualways.com`. Restart.
   The server refuses to start if these are half-set, swapped, the redirect isn't exactly the callback route,
   or it isn't https.
4. Check: `/api/auth/google/status` → `{"configured":true}`; then sign in once with a real Google account
   on the live site and confirm `/account` shows it. Until configured, the site says Google sign-in isn't
   set up — sign-in is never simulated.

## Account emails (needs a mailbox)
Messages: confirm email, reset password, password changed/reset notice, account deleted notice
(`src/services/emailTemplates.ts`, plain text + HTML).
1. Create a sending mailbox, e.g. `no-reply@beingyoualways.com` (hPanel → Emails), and set SPF/DKIM for the domain.
2. Set `MAIL_TRANSPORT=smtp`, `SMTP_HOST` (Hostinger: `smtp.hostinger.com`), `SMTP_PORT=465`,
   `SMTP_USER` (the mailbox address), `SMTP_PASSWORD`, `MAIL_FROM`. Restart.
3. Register a test account and confirm the email arrives; Admin → Client approvals shows email as confirmed.
Without SMTP the server writes each message to `MEDIA_ROOT/outbox/` and the site says the email is
queued — it never claims an email was sent.

## Media files
Uploads go to `MEDIA_ROOT` (photos converted to WebP with thumbnails; videos kept as uploaded) and their
details to MySQL; files are only ever served through the API, which checks visibility. `MEDIA_ROOT` must be an
absolute folder outside the deploy folder (see step 2) and is backed up together with the database:
```bash
tar -czf ~/backups/bya-media-$(date +%F).tar.gz -C ~ bya-media     # restore: tar -xzf … -C ~
```

## Phase 4 — WhatsApp Cloud API (built, needs the owner's Meta credentials)
Everything WhatsApp runs on this server; the website only calls the store API. Nothing is sent while the
`WHATSAPP_*` variables are missing, and a message counts as sent only when Meta returns a message id —
"delivered"/"read" only when Meta's webhook says so.

**1. Variables (hPanel → Node.js app → Environment):** see `.env.example` (Phase 4). Use a *System User* token
(Business Settings → Users → System users → Generate token, never-expiring) with `whatsapp_business_messaging`
and `whatsapp_business_management`. The server refuses to start if only some values are set or IDs look swapped.

**2. Webhook (Meta App → WhatsApp → Configuration):** Callback URL `https://<api-domain>/api/whatsapp/webhook`,
Verify token = `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, then *Verify and save* and subscribe to **messages**,
**message_template_status_update**, **account_update** and **phone_number_quality_update**. Subscribe the app to the
business account once:
```bash
curl -X POST -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN" "https://graph.facebook.com/v25.0/$WHATSAPP_WABA_ID/subscribed_apps"
```
Every delivery is checked against `X-Hub-Signature-256` (App Secret) before it is stored; duplicates are ignored.

**3. Templates (WhatsApp Manager → Message templates):** create each template with the wording shown in
Admin → WhatsApp API → Message templates (the variables must match exactly), wait for Meta's approval, then
enter the exact names there. Sign-in codes need an *Authentication* template with a Copy code button. Unapproved
or mismatched templates are never sent — the admin shows why.

**4. Check:** Admin → WhatsApp API → *Check now* and *Integration checks* (the test message goes only to numbers in
`WHATSAPP_TEST_RECIPIENTS`).

What it does: WhatsApp sign-in codes (hashed, 5-minute expiry, single use, 60 s resend, 3/hour, 15-minute lock after
5 wrong codes); order updates (confirmed, paid, COD placed, packed, shipped, out for delivery, delivered, cancelled)
only with the shopper's consent and never twice; one 6-hour bag reminder with consent (cancelled when they order);
marketing campaigns that send only after the owner approves the exact audience; a chatbot that answers from real
orders, products, shipping settings and policy pages and hands anything else to Admin → Chatbot; STOP opt-outs;
delivery receipts; retries with backoff; a revoked token pauses sending and shows a banner. The queue lives in MySQL
(`WhatsAppMessage`), so restarts lose nothing; one server instance at a time runs the sender (database lease).

Not built yet: refunds from the admin. Order emails reuse the account mailer later.
