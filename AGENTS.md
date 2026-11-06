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
- Homepage hero uses the BeforeAfter image slider (AI images allowed there only, by user approval); no 3D in the hero.
- Catalogue data lives in `src/lib/catalogue.json` (imported from beingyoualways.com) mapped in `mock-data.ts`; product photos are registered by slug in `src/lib/product-images.ts` (`src/assets/products/<slug>-<n>.webp`) and passed via `ProductVisual src` — one source so every page matches.
- Scroll/text/image reveals use `src/components/motion/Reveal.tsx` (one shared IntersectionObserver + one parallax loop) with CSS in `styles.css`; content is hidden only under `html.motion-ok`, so reduced-motion users and no-JS still see everything. Use `motion/react` only for enter/exit (cart lines, gallery, price swaps).
- Public testimonials come only from `testimonialService` entries that are verified + consented + published (managed at `/admin/testimonials`); never hardcode review copy — avoids fabricated reviews.
- Concern and curated-collection (De-Tan, Combos) membership lives in `src/lib/concerns.ts`; empty lists render the shared empty state — never add products just to fill a page.
- Verified business facts (contact, founder, about copy, nav, policy links, shipping-confirmed flag) live in `src/config/business.ts`; components import from it, never hardcode — one place to edit and later swap for the Hostinger API.
- Sign-in providers go through `src/services/authService.ts` and checkout payment choice through `src/components/shop/PaymentMethods.tsx`; neither may fake a session, payment or order — one place to wire Hostinger OAuth/Razorpay later.
