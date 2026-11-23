# Being You – Always — API server (Phase 1)

Express + TypeScript + Prisma on **Hostinger MySQL/MariaDB**. Serves the product catalogue to the
website and secure admin sign-in + product management to `/admin`.

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

## Tables (migration `prisma/migrations/*_init`)
User, Role, Permission, RolePermission, UserRole, Session, PasswordResetToken, Category, Product,
ProductVariant, Inventory, ProductImage, Customer, ShippingAddress, Order, OrderItem, Payment, Discount,
Review, WhatsAppConsent, SiteContent, StoreSetting, AdminActivityLog.
Only users/sessions and the catalogue are used by Phase 1 endpoints; the other tables are ready for later phases.

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
Note: a few customer videos/photos are hosted on Lovable's asset storage (`*.asset.json` pointers);
move those files to Hostinger media before switching off the Lovable deployment.

## Admin accounts and recovery
- There is no public sign-up. The first account is created with `admin:create` (must be the owner).
  More accounts: `npm run admin:create -- --email x --name y --role admin --allow-additional`.
- Forgotten password: `npm run admin:reset-password -- --email owner@beingyoualways.com` — sets a new
  password, clears the lock and signs that account out everywhere. Emailed reset links are prepared in the
  schema (`PasswordResetToken`) and service, but need an email provider (later phase).
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

## Later phases (structure ready, not implemented)
Razorpay (orders + webhook signature verification; `Payment` only becomes `PAID` after verification),
Cash on Delivery, Google sign-in (`Customer.googleSub`), WhatsApp Cloud API + OTP
(`docs/whatsapp-hostinger-backend.md`), order notifications, 6-hour abandoned-cart reminders, review
photo/video uploads to Hostinger storage, discounts, real sales analytics. Each needs its own endpoints,
secrets in server environment variables and real tests before it is marked connected.
