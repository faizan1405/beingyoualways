<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Pages read data only via `src/services/*Service.ts` (never mock arrays): browser demo store while `VITE_API_BASE_URL` is unset, Hostinger API via `apiRequest` (`api.ts`) when set. In live mode only `LIVE_ADMIN_PATHS` admin areas render; others show "Not connected yet" — no demo figures in production.
- `server/` is a separate npm package (Express + Prisma/MySQL, own tsconfig/tests, outside root lint/tsc): schema changes = new migration in `server/prisma/migrations`; the seed `server/prisma/seed/catalogue.json` is regenerated from the storefront via `src/test/catalogue-snapshot.test.ts`; DB photos are `asset:` refs (`src/lib/image-refs.ts`) or https URLs.
- Storefront routes live under the `_site` pathless layout (header/footer); `/admin/*` has its own shell — keeps admin chrome separate.
- Homepage hero: scroll-controlled crossfade of two aligned Before/After photos in `Hero.tsx` (no slider, bar, autoplay or 3D). AI images only there and in `/explore-concerns` (`src/assets/concerns/`), by user approval; no disclosure caption.
- Scroll-linked scenes (`Hero`, `ScrollStory`, `ConcernStory`) use a bounded CSS-sticky inner panel inside a fixed-height wrapper (hero shortest) with progress from the wrapper position; never intercept wheel/touch, lock body scroll or autoplay — the scene releases naturally.
- Catalogue: `src/lib/catalogue.json` (read-only) → `mock-data.ts`; verified changes are patches in `catalogue-revision.ts` (bump `CATALOGUE_REVISION`; `reviseStored` upgrades saved data once, keeping admin edits). Photos: gallery `src/assets/products/gallery/<slug>/0N-<view>.webp` (real pack cut-out, never AI labels) via `catalogueImages`; originals `<slug>-<n>.webp` stay as backup/decor. Sheet/claims/unsure photos: `src/content/product-sheet.ts`, admin-only until confirmed.
- Reveals use `src/components/motion/Reveal.tsx` (one shared observer + parallax loop); content hides only under `html.motion-ok`, so reduced-motion/no-JS users see everything. `motion/react` only for enter/exit.
- Public testimonials come only from `testimonialService` entries that are verified + consented + published (managed at `/admin/testimonials`); never hardcode review copy — avoids fabricated reviews.
- Brand-published customer media (photo sets, portrait video reviews) is seeded in `src/content/customer-media.ts` (videos as lovable-assets pointers) and served via `customerMediaService`; shown only when consent + published, with no added quotes or result claims.
- Concern and curated-collection (De-Tan, Combos) membership lives in `src/lib/concerns.ts`; empty lists render the shared empty state — never add products just to fill a page.
- Verified business facts (contact, founder, about copy, nav, policy links, shipping-confirmed flag) live in `src/config/business.ts`; components import from it, never hardcode — one place to edit and later swap for the Hostinger API.
- Bag/checkout totals, the demo per-item quantity limit (a bag cap, never worded as stock) and shipping status come only from `src/lib/pricing.ts` (`summarize` returns `total: null` while shipping is unconfirmed); variant choice, availability wording and which product-info sections are public come from `src/lib/variants.ts` — one place for pricing and "don't show unverified facts" rules.
- Sign-in goes through `authService.ts` (demo OTP only while no backend), payment choice through `PaymentMethods.tsx`; WhatsApp rules in `src/lib/whatsapp-cloud.ts`, Hostinger contracts in `whatsappCloudService.ts`, Meta IDs in `src/config/whatsapp.ts`. Never fake a session, payment, send or delivery; Meta calls and tokens stay on the Hostinger server.
- Policy pages render text migrated verbatim from beingyoualways.com in `src/content/policies.json`; review flags and legal-approval status live in `src/content/policies.ts` — never rewrite legal wording or mark approved without the client.
- Persistence: checkout drafts via `src/lib/checkout-draft.ts`; admin data via `createDemoStore` (`src/lib/demo-store.ts`) inside `src/services/*` — `local` for non-personal, `session` for orders/customers/reviews (not exported). Never personal/payment data or secrets in localStorage.
- The internal pre-launch checklist (`/admin/approvals`) is computed in `src/lib/approvals.ts` from live data and the confirmation flags in `business.ts`; never tick items by hand — an item turns confirmed only when the fact exists.
- Buttons share one system: shapes/colours in `ui/button.tsx` (`buttonVariants`, `chipVariants` for toggle chips) and motion in `styles.css` utilities (`btn-motion`, `btn-fill`, `btn-lift`, `btn-rise`, `btn-underline`); hand-built CTAs reuse them, `[data-admin]` drops lift/sweep — one consistent look, hover only on hover-capable pointers, reduced motion respected.
- Customer videos use the shared `VideoReviews` card: `<video preload="none">` rendered up front and `play()` called synchronously in the click handler (Safari/iOS refuse deferred unmuted play), one player at a time, visible error fallback — never defer play() to rAF/timeouts.
- Original-site brand claims (What We Stand For, Global Standards) are copied verbatim into `business.ts` and gated by `BRAND_CLAIMS_CONFIRMED` in the approvals checklist — never paraphrase or add certifications.
- Themes: `src/lib/theme-preview.ts`; shoppers get `APPROVED_THEME` (tokens in `:root`), others only via `?theme=`, the A/B bar or `/admin/settings` as pre-paint `html[data-theme]` overrides in `styles.css` — experiments stay reversible.
- Admin photo replacement goes through `withMainImage`/`withExtraImage` in `product-images.ts` and `src/lib/image-upload.ts` (demo: resized data URL in this browser) — only the image list changes, never id, prices or variants; swap the upload helper for the Hostinger media API later.
- Homepage Best Seller = `selectHighDemand` (active + `bestSeller`, `bestSellerSlugs` first; picks applied once per version, then admin toggles persist); category tabs = `homeCategoryGroups` in `concerns.ts` — never pad either.
- The header and every main page section paint `bg-page` (`--surface-page`, an alias of `--background` in `styles.css`); only intentional storytelling/brand bands (colour-shift scenes, policy banners, footer) use their own colours — keeps header and page visually seamless in any theme.
- Storefront product views use `useLiveProduct(s)` so browser-saved admin edits replace SSR data after mount; `getBySlug` returns active products only (drafts unreachable).
- Admin-editable storefront text comes via `useSiteContent()` (defaults from `business.ts`); admin security is server-side (sessions + permissions in `server/`); the demo gate is not security.
- Checkout and money (Phase 2): the Hostinger server prices every order in integer paise from the database (prices, stock holds, discounts, shipping, COD charge) and marks orders paid only after Razorpay signature + payment fetch or a verified webhook; the website only shows server quotes (`shopService.ts`), admin live screens live in `src/components/admin/live/` and are chosen per route with `isBackendConfigured()`, and production builds without `VITE_API_BASE_URL` disable demo storage, demo reset and the admin (`DEMO_MODE`) — browser totals are never trusted and demo data never reaches production.
