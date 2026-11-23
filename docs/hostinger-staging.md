# Being You – Always — Hostinger staging (Phase 6)

A private, password-protected copy of the whole store (website + API + its own MySQL database + its own
media folder) on Hostinger, deployed from GitHub, so everything can be tested with real providers before
the real website is switched. **Nothing here touches the existing live website** — staging uses new
subdomains, a new database and new folders. **Do not deploy or publish without the owner's approval.**

## 1. What protects the live store

| Risk | Guard (enforced by the code, not by convention) |
|---|---|
| Staging writes to live customers, stock, orders | `STORE_ENVIRONMENT` is required in production. The database and `MEDIA_ROOT` are stamped with it at the first start; a staging server refuses a database/folder stamped `production` (and vice versa). `deploy:check` also fails when a staging database holds non-test orders (a copied live database). |
| Real payment captured | Staging refuses `rzp_live_` keys; every staging order is a **Test** order (`STORE_TEST_MODE` is forced on, `false` is refused) and never counts as a sale. |
| Real customers messaged | Staging sends WhatsApp **only** to `WHATSAPP_TEST_RECIPIENTS` (required when WhatsApp is on); every other send is recorded as *Not sent: staging store*. SMTP mail goes **only** to `MAIL_ALLOWED_RECIPIENTS`; everything else stays in `MEDIA_ROOT/outbox`, marked *Held*. Nothing is ever reported as sent when it wasn't. |
| Staging sign-in cookies reaching the live store | Staging uses its own cookie names (`bya_staging_*`; the live names are refused) and host-only cookies (`COOKIE_DOMAIN` must be empty). |
| Public visitors / search engines | Staging website build (`VITE_SITE_ENV=staging`) asks for a password (`STAGING_ACCESS_PASSWORD`, 12+ characters; without it the site stays locked with a 503). Every page has `noindex` (meta + `X-Robots-Tag`), `robots.txt` disallows everything, and a strip on every page says it's a test copy. The API is never indexable (staging or live). |
| Uploads lost on redeploy | `MEDIA_ROOT` must be an absolute folder outside the deploy folder; the server refuses to start otherwise. |
| Secrets in GitHub | Values only in hPanel environment variables; `.env*` is git-ignored; templates hold names only. |

Note: static files (page scripts, styles, icons) are served without the password; they contain no store data.

## 2. Addresses

| | Staging | Live (later, after approval) |
|---|---|---|
| Website | `https://staging.beingyoualways.com` | `https://beingyoualways.com` |
| API | `https://api-staging.beingyoualways.com` | `https://api.beingyoualways.com` |
| Google callback | `https://api-staging.beingyoualways.com/api/auth/google/callback` | `https://api.beingyoualways.com/api/auth/google/callback` |
| Razorpay webhook | `https://api-staging.beingyoualways.com/api/webhooks/razorpay` | `https://api.beingyoualways.com/api/webhooks/razorpay` |
| WhatsApp webhook | `https://api-staging.beingyoualways.com/api/whatsapp/webhook` | `https://api.beingyoualways.com/api/whatsapp/webhook` |

Use two **subdomains of beingyoualways.com** (adding two DNS records doesn't change the live site). Website
and API are then "same-site", so sign-in cookies work in every browser with `SameSite=lax`. Hostinger's
temporary `*.hostingersite.com` addresses are separate sites: sign-in would need `COOKIE_SAMESITE=none` and
still fails in Safari — use them only for a first smoke test.

## 3. GitHub → Hostinger steps (staging)

Branches: Lovable pushes to `main`. Staging deploys **`main`** automatically. Later the live apps deploy a
separate **`production`** branch that is only moved forward (GitHub → *Compare & pull request* `main` →
`production`) after staging is signed off — that branch is also how you roll back code.

1. **Plan**: Hostinger Business/Cloud (Node.js web apps) or a VPS. Node 20 or 22.
2. **DNS** (where beingyoualways.com's DNS is managed): add `staging` and `api-staging` exactly as hPanel
   shows when you attach the domains in steps 5–6 (A or CNAME records). Leave every existing record alone.
3. **Database**: hPanel → Databases → MySQL → create a **new** database + user only for staging
   (e.g. `u123_bya_staging`). Never reuse the live one.
4. **Media folder** (SSH or File Manager): `mkdir -p ~/bya-media-staging && chmod 750 ~/bya-media-staging`.
5. **API app**: Websites → Add website → Node.js app → Import Git repository → this repo, branch `main`.
   - Application root `server` · Build `npm ci && npm run build` · Start `npm start`
   - Environment variables: every name in `server/.env.staging.example` (section 4 below).
   - Domain `api-staging.beingyoualways.com`, SSL **on**.
   - First deploy only, from SSH in the app's `server` folder:
     ```bash
     npm run db:migrate          # prisma migrate deploy — never resets or drops
     npm run db:seed:prod        # roles, categories, the 22-product catalogue (never duplicates)
     npm run admin:create -- --email owner@beingyoualways.com --name "Store Owner"   # asks for a password
     npm run deploy:check -- --api-url https://api-staging.beingyoualways.com
     ```
   - Restart the app once after migrating. The first start stamps the database and media folder `staging`.
6. **Website app**: Add website → Node.js app → same repo, branch `main`.
   - Application root: repository root · Build `npm install && NITRO_PRESET=node-server npm run build` ·
     Start `node .output/server/index.mjs`
   - Environment (build **and** run time): `VITE_API_BASE_URL=https://api-staging.beingyoualways.com`,
     `VITE_SITE_ENV=staging`, `STAGING_ACCESS_PASSWORD` (12+ random characters, shared only with testers).
   - Domain `staging.beingyoualways.com`, SSL **on**.
7. **Check**: `npm run deploy:check -- --api-url https://api-staging.beingyoualways.com --providers`
   must end with *No problems* (warnings are fine for providers not switched on yet).
8. **Admin → Settings**: enter shipping, COD and stock for test products (the owner's figures — never invented).

Later deploys: push to `main` → Hostinger rebuilds. If the commit adds a migration: back up (section 7),
`npm run db:migrate`, restart, `deploy:check`.

## 4. Environment variables (names only — values live in hPanel)

**Staging API** (`server/.env.staging.example` has comments for each):
`NODE_ENV=production`, `STORE_ENVIRONMENT=staging`, `PORT`, `DATABASE_URL`, `CORS_ORIGINS`, `PUBLIC_SITE_URL`,
`COOKIE_DOMAIN` (empty), `COOKIE_SAMESITE`, `TRUST_PROXY`, `LOG_LEVEL`, `ORDER_LINK_SECRET`, `AUTH_SECRET`,
`MEDIA_ROOT`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `AUTH_GOOGLE_ID`,
`AUTH_GOOGLE_SECRET`, `GOOGLE_REDIRECT_URL`, `MAIL_TRANSPORT`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASSWORD`, `MAIL_FROM`, `MAIL_ALLOWED_RECIPIENTS`, `WHATSAPP_APP_ID`, `WHATSAPP_WABA_ID`,
`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`,
`WHATSAPP_GRAPH_API_VERSION`, `WHATSAPP_TEST_RECIPIENTS`. Optional: `PAYMENT_HOLD_MINUTES`, `SESSION_*`,
`CUSTOMER_SESSION_*`, `LOGIN_*`, `MEDIA_MAX_*`, `WHATSAPP_WORKER`.

**Staging website**: `VITE_API_BASE_URL`, `VITE_SITE_ENV=staging`, `STAGING_ACCESS_PASSWORD`, `NITRO_PRESET=node-server` (in the build command).

**Live API** (later): the same list as `server/.env.example` with `STORE_ENVIRONMENT=production`, its own
database, `MEDIA_ROOT`, secrets and live addresses. **Live website**: `VITE_API_BASE_URL` only (no `VITE_SITE_ENV`).

Generate each random secret separately (never copy staging values to live):
`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

## 5. External services (staging)

- **Google** (Cloud Console → APIs & Services): OAuth consent screen (app name, support email, privacy policy
  `https://beingyoualways.com/privacy-policy`, scopes openid/email/profile, authorised domain
  `beingyoualways.com`; while in *Testing*, add the testers' Google accounts). Credentials → OAuth client
  (Web application) → Authorised redirect URI exactly the staging callback above. Set `AUTH_GOOGLE_ID`,
  `AUTH_GOOGLE_SECRET`, `GOOGLE_REDIRECT_URL`, `AUTH_SECRET`. `deploy:check --providers` confirms Google accepts the pair.
- **Razorpay Test Mode**: Dashboard in *Test mode* → API Keys → generate → `RAZORPAY_KEY_ID` (`rzp_test_…`),
  `RAZORPAY_KEY_SECRET`. Webhooks (test mode) → add the staging webhook URL, a strong secret →
  `RAZORPAY_WEBHOOK_SECRET`, events `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`,
  `refund.processed`. Test cards/UPI from Razorpay's docs never move money.
- **WhatsApp (Meta)**: System User token (`whatsapp_business_messaging`, `whatsapp_business_management`) →
  `WHATSAPP_ACCESS_TOKEN`; App settings → Basic → App secret → `WHATSAPP_APP_SECRET`; a random
  `WHATSAPP_WEBHOOK_VERIFY_TOKEN`. App → WhatsApp → Configuration: callback = staging webhook URL, verify token,
  subscribe to messages, message_template_status_update, account_update, phone_number_quality_update. Then once:
  `curl -X POST -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN" "https://graph.facebook.com/v25.0/$WHATSAPP_WABA_ID/subscribed_apps"`.
  Create and get approval for the templates listed in Admin → WhatsApp API. Put the testers' numbers in
  `WHATSAPP_TEST_RECIPIENTS`. Meta allows one webhook address per app: when going live, point it at the live API.
- **SMTP**: hPanel → Emails → create `no-reply@beingyoualways.com`, set SPF/DKIM/DMARC; `MAIL_TRANSPORT=smtp`,
  `SMTP_HOST=smtp.hostinger.com`, `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASSWORD`, and `MAIL_ALLOWED_RECIPIENTS`
  (the testers' inboxes or `@beingyoualways.com`).
- **Background jobs** run inside the API process: WhatsApp sender, 6-hour bag reminders and campaigns (MySQL
  lease, one sender at a time) and the payment sweep every 5 minutes. Keep exactly one API instance running;
  no cron setup is needed.

## 6. End-to-end tests on staging — all PENDING until staging exists

Run in order; record date, tester, result. `deploy:check` first.

| # | Test | How | Pass when |
|---|---|---|---|
| 1 | Registration + login | Register with an allowed inbox; open the confirm link; sign out/in | Email arrives; account shows the name; wrong password refused |
| 2 | Google sign-in | Sign in with a real test Google account | Returns to `/account` signed in |
| 3 | Browsing + inventory | Set stock 2 on a product; add 3 | Bag caps / server refuses the third |
| 4 | Cart + checkout | Bag → checkout → quote | Totals match Admin → Settings figures |
| 5 | Razorpay test payment | Pay with a Razorpay test card/UPI | Order *Paid* (Test); webhook appears in payment events; stock reduced |
| 6 | Failed/closed payment | Close the window; use a failing test card | Order stays unpaid, stock released after the hold |
| 7 | COD order | Place COD (if the owner enabled it) | Order *COD placed*, Test label |
| 8 | Admin fulfilment | Packed → shipped (tracking) → out for delivery → delivered | Timeline + shopper's order page update |
| 9 | Email confirmation | Steps 1 and password reset | Arrives in the allowed inbox; a non-listed address stays in the outbox |
| 10 | WhatsApp test message | Admin → WhatsApp API → test to a listed number | Delivered tick from Meta's webhook |
| 11 | WhatsApp to a non-listed number | Order with an unlisted phone + consent | Message log: *Not sent: staging store* |
| 12 | 6-hour bag reminder | Tick the reminder at checkout with a listed number; leave | Admin → Abandoned cart shows it due 6 h later; it arrives; ordering cancels it |
| 13 | Persistent media | Upload a product photo + a story video; push a commit (redeploy) | Both still load after the redeploy |
| 14 | Persistence after restart | hPanel → Restart the API | Orders, sessions, queued messages are all still there |
| 15 | Locked + not indexed | Open staging in a private window; fetch `/robots.txt` | Password prompt; `Disallow: /` |

## 7. Backups and rollback

- **Before every deploy with a migration** (and nightly via Hostinger backups):
  ```bash
  mysqldump --single-transaction --routines -h HOST -u USER -p DB_NAME > ~/backups/bya-staging-$(date +%F-%H%M).sql
  tar -czf ~/backups/bya-media-staging-$(date +%F).tar.gz -C ~ bya-media-staging
  ```
  Keep backups outside both app folders. Database and media belong together.
- **Code rollback**: on GitHub, revert the bad commit on `main` (staging) — Hostinger rebuilds from the new
  commit — or move the `production` branch back to the previous release commit (live) and redeploy it in hPanel.
- **Database rollback**: migrations are forward-only. If a migration fails or must be undone: stop the API,
  import the pre-deploy dump into a new empty database (or the same one after dropping it), point
  `DATABASE_URL` at it, redeploy the previous code, start, run `deploy:check`. Orders taken after the dump are
  in the newer database only — on live, export them first.
- **Media rollback**: `tar -xzf ~/backups/bya-media-…tar.gz -C ~` (deploys never delete media).
- Never run `prisma migrate dev`, `migrate reset` or `db push` on Hostinger.

## 8. Moving from staging to live (only with the owner's approval)

Create the live database, `~/bya-media` and the two live apps from branch `production` with
`STORE_ENVIRONMENT=production` and **new** secrets, live Razorpay keys only after test sign-off, Meta webhook
re-pointed to the live API, Google redirect URI for the live API. Run `deploy:check --providers`, then switch
the `beingyoualways.com` DNS last. Keep staging running (password-protected) for future changes.
