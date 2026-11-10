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
- Storefront is frontend-only; pages read data via `src/services/*Service.ts`, never mock arrays directly — so services can be swapped for Hostinger REST calls.
- Storefront routes live under the `_site` pathless layout (header/footer); `/admin/*` has its own shell — keeps admin chrome separate.
- Homepage hero is a scroll-controlled crossfade of two aligned Before/After photos in `Hero.tsx` (short bounded sticky scene, page scroll drives it; no slider, bar or autoplay); no 3D in the hero. AI images are allowed only there and in `/explore-concerns` (`src/assets/concerns/`), by user approval; the public disclosure caption was removed at the user's request.
- Scroll-linked scenes (`Hero`, `ScrollStory`, `ConcernStory`) use a bounded CSS-sticky inner panel inside a fixed-height wrapper (hero shortest) with progress from the wrapper position; never intercept wheel/touch, lock body scroll or autoplay — the scene releases naturally.
- Catalogue data lives in `src/lib/catalogue.json` (imported from beingyoualways.com) mapped in `mock-data.ts`; product photos are registered by slug in `src/lib/product-images.ts` (`src/assets/products/<slug>-<n>.webp`) and passed via `ProductVisual src` — one source so every page matches.
- Scroll/text/image reveals use `src/components/motion/Reveal.tsx` (one shared IntersectionObserver + one parallax loop) with CSS in `styles.css`; content is hidden only under `html.motion-ok`, so reduced-motion users and no-JS still see everything. Use `motion/react` only for enter/exit (cart lines, gallery, price swaps).
- Public testimonials come only from `testimonialService` entries that are verified + consented + published (managed at `/admin/testimonials`); never hardcode review copy — avoids fabricated reviews.
- Brand-published customer media (photo sets, portrait video reviews) is seeded in `src/content/customer-media.ts` (videos as lovable-assets pointers) and served via `customerMediaService`; shown only when consent + published, with no added quotes or result claims.
- Concern and curated-collection (De-Tan, Combos) membership lives in `src/lib/concerns.ts`; empty lists render the shared empty state — never add products just to fill a page.
- Verified business facts (contact, founder, about copy, nav, policy links, shipping-confirmed flag) live in `src/config/business.ts`; components import from it, never hardcode — one place to edit and later swap for the Hostinger API.
- Bag/checkout totals, the demo per-item quantity limit (a bag cap, never worded as stock) and shipping status come only from `src/lib/pricing.ts` (`summarize` returns `total: null` while shipping is unconfirmed); variant choice, availability wording and which product-info sections are public come from `src/lib/variants.ts` — one place for pricing and "don't show unverified facts" rules.
- Sign-in providers go through `src/services/authService.ts` and checkout payment choice through `src/components/shop/PaymentMethods.tsx`; neither may fake a session, payment or order — one place to wire Hostinger OAuth/Razorpay later.
- Policy pages render text migrated verbatim from beingyoualways.com in `src/content/policies.json`; review flags and legal-approval status live in `src/content/policies.ts` — never rewrite legal wording or mark approved without the client.
- Checkout contact/address drafts go only through `src/lib/checkout-draft.ts` (sessionStorage, known fields only, cleared on finish); never put personal or payment data in localStorage — limits what a shared device retains.
- The internal pre-launch checklist (`/admin/approvals`) is computed in `src/lib/approvals.ts` from live data and the confirmation flags in `business.ts`; never tick items by hand — an item turns confirmed only when the fact exists.
- Button motion lives in `styles.css` utilities (`btn-motion`, `btn-lift`, `btn-underline`) applied through `ui/button.tsx` variants; hand-built CTAs reuse those utilities or `buttonVariants` — one motion language, hover only on hover-capable pointers, reduced motion respected.
- Customer videos use the shared `VideoReviews` card: `<video preload="none">` rendered up front and `play()` called synchronously in the click handler (Safari/iOS refuse deferred unmuted play), one player at a time, visible error fallback — never defer play() to rAF/timeouts.
- Original-site brand claims (What We Stand For, Global Standards) are copied verbatim into `business.ts` and gated by `BRAND_CLAIMS_CONFIRMED` in the approvals checklist — never paraphrase or add certifications.
