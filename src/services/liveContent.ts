// Storefront wording from the Hostinger server (public read). The built-in copy renders first;
// once the server's stored wording arrives it is merged over the defaults and the page updates.
// A unreachable server or an empty table simply means "the site uses its built-in copy".
import { API_ENDPOINTS, HOSTINGER_API_BASE_URL, isBackendConfigured } from "./api";
import { SITE_CONTENT_KEY } from "./adminContentService";
import { defaultContent, mergeSiteContent, type SiteContent } from "./contentService";

let cache: SiteContent = defaultContent();
const SERVER_SNAPSHOT: SiteContent = cache;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function load() {
  if (loaded || !isBackendConfigured() || !HOSTINGER_API_BASE_URL) return;
  loaded = true;
  try {
    const res = await fetch(`${HOSTINGER_API_BASE_URL}${API_ENDPOINTS.publicContent}`, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!res.ok) { loaded = false; console.warn(`Store server: page text not loaded (${res.status})`); return; }
    const body = (await res.json()) as { content?: Record<string, unknown> };
    const next = mergeSiteContent(body.content?.[SITE_CONTENT_KEY]);
    if (JSON.stringify(next) !== JSON.stringify(cache)) { cache = next; emit(); }
  } catch (e) {
    loaded = false; // try again on the next page that needs it
    console.warn("Store server: page text not loaded", e);
    // keep the built-in copy — the shop must never go blank because the server is down
  }
}

export const liveContentStore = {
  subscribe: (fn: () => void) => { listeners.add(fn); void load(); return () => { listeners.delete(fn); }; },
  get: (): SiteContent => cache,
  server: (): SiteContent => SERVER_SNAPSHOT,
  /** Admin saved new wording — pull it again without a page reload. */
  refresh: () => { loaded = false; void load(); },
};
