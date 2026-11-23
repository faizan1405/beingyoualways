# Being You – Always — API server (Phases 1–2)

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

Needs a Hostinger plan with **Node.js web apps** (check your plan in hPanel; a VPS also works).
Deploy two apps from the same repository: the **API** (this folder) and the **website** (repository root).
Recommended: website on `beingyoualways.com`, API on `api.beingyoualways.com` (same site → `COOKIE_SAMESITE=lax`).

## 1. Database
hPanel → **Databases → MySQL Databases**: create a database + user. Note host, name, user, password.
Build `DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/NAME"` (URL-encode special characters in the password).

## 2. API app
hPanel → **Websites → Add website → Node.js app → Import from GitHub**
- Root / application directory: `server`
- Node version: 20 or 22
- Install: `npm ci` · Build: `npm run build` · Start: `npm start` (entry `dist/src/index.js`)
- Environment variables: everything in `.env.example` (`NODE_ENV=production`, `DATABASE_URL`,
  `CORS_ORIGINS=https://beingyoualways.com,https://www.beingyoualways.com`, `COOKIE_DOMAIN=.beingyoualways.com`
  when the API is on a subdomain). Never commit real values.
- Domain: attach `api.beingyoualways.com` and enable SSL.

Then, once, from the app's terminal/SSH in the `server` folder:
```bash
npm run db:migrate          # applies prisma/migrations (safe to re-run)
npm run db:seed:prod        # roles + 3 categories + the catalogue (never duplicates or overwrites)
npm run admin:create -- --email owner@beingyoualways.com --name "Store Owner"   # prompts for the password
```
Check: `https://api.beingyoualways.com/api/health` → `{"status":"ok","database":"ok"}`.

## 3. Website app
Same flow with application directory = repository root:
- Build: `NITRO_PRESET=node-server npm run build` · Start: `node .output/server/index.mjs`
- Environment (build time): `VITE_API_BASE_URL=https://api.beingyoualways.com`
- Without `VITE_API_BASE_URL` the site builds in labelled demo mode — always set it for production.

The website's own build was checked with `NITRO_PRESET=node-server` (Node output in `.output/`).
All product photos and customer videos/photos are real files inside the repository (no Lovable-hosted media).

## Admin accounts and recovery
- There is no public sign-up. The first account is created with `admin:create` (must be the owner).
  More accounts: `npm run admin:create -- --email x --name y --role admin --allow-additional`.
- Forgotten password: `npm run admin:reset-password -- --email owner@beingyoualways.com` — sets a new
  password, clears the lock and signs that account out everywhere. Admins have no emailed reset link;
  shoppers do (see "Account emails" below).
- Passwords: at least 12 characters; common/guessable passwords are refused.

## Backups and recovery
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

## Google sign-in (needs the owner's Google account)
1. Google Cloud Console → create a project → **OAuth consent screen**: app name "Being You – Always",
   support email, website + privacy policy links, scopes `openid`, `email`, `profile` → publish.
2. **Credentials → Create credentials → OAuth client ID → Web application**.
   Authorised redirect URI: `https://api.beingyoualways.com/api/auth/google/callback` (exactly).
3. Put the values in the API app's environment: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `GOOGLE_REDIRECT_URL` (the URI above) and `PUBLIC_SITE_URL=https://beingyoualways.com`. Restart.
4. Check: `/api/auth/google/status` → `{"configured":true}`; the Google button on /login then sends
   shoppers to Google. Until then it says Google sign-in isn't configured — sign-in is never simulated.

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
details to MySQL. Put `MEDIA_ROOT` outside the deploy folder (e.g. `/home/USER/bya-media`) so redeploys
keep it, and back it up together with the database.

## Later phases (structure ready, not implemented)
WhatsApp Cloud API + OTP (`docs/whatsapp-hostinger-backend.md`),
order emails/WhatsApp notifications, 6-hour abandoned-cart reminders, refunds from the admin.
Each needs its own endpoints, secrets in server environment
variables and real tests before it is marked connected.
