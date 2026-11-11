// Reversible theme preview. The public storefront always renders APPROVED_THEME;
// another theme only appears on a device where someone opened a preview link
// (?theme=white / ?theme=ivory) or used the admin switcher. ?theme=off ends it.
// Only the theme name is stored — never personal data.

export type SiteTheme = "ivory" | "white";

export const THEMES: Record<SiteTheme, { option: "A" | "B"; label: string; note: string }> = {
  ivory: { option: "A", label: "Previous Ivory", note: "Retired — warm ivory and cream surfaces, kept for comparison only." },
  white: { option: "B", label: "Clean White", note: "Approved public theme — #FFFFFF background with very light neutral grey surfaces." },
};

/** The theme every shopper sees. Change only after the client picks a final option. */
export const APPROVED_THEME: SiteTheme = "white";
/** Flip to true once the client has chosen the final theme (and APPROVED_THEME is set to it). */
export const THEME_CHOICE_CONFIRMED = true;

export const THEME_PREVIEW_KEY = "by-theme-preview";

export const isTheme = (v: unknown): v is SiteTheme => v === "ivory" || v === "white";

/**
 * Works out which theme to show. `param` is the ?theme= value (if any),
 * `stored` the previously chosen preview. Returns what to store next too.
 */
export function resolveTheme(param: string | null, stored: string | null): { theme: SiteTheme; previewing: boolean; store: SiteTheme | null } {
  if (param === "off" || param === "default") return { theme: APPROVED_THEME, previewing: false, store: null };
  if (isTheme(param)) return { theme: param, previewing: true, store: param };
  if (isTheme(stored)) return { theme: stored, previewing: true, store: stored };
  return { theme: APPROVED_THEME, previewing: false, store: null };
}

/** Runs before first paint (inline in <head>) so the preview never flashes the other theme. */
export const themePreInitScript = `try{var k=${JSON.stringify(THEME_PREVIEW_KEY)},d=document.documentElement,q=new URLSearchParams(location.search).get('theme'),s=localStorage.getItem(k);if(q==='off'||q==='default'){localStorage.removeItem(k);s=null}else if(q==='white'||q==='ivory'){localStorage.setItem(k,q);s=q}if(s==='white'||s==='ivory'){d.setAttribute('data-theme-preview',s);if(s==='ivory')d.setAttribute('data-theme','ivory')}}catch(e){}`;

type Listener = () => void;
const listeners = new Set<Listener>();

export function readPreview(): SiteTheme | null {
  if (typeof document === "undefined") return null;
  const v = document.documentElement.getAttribute("data-theme-preview");
  return isTheme(v) ? v : null;
}

/** Switch (or end, with null) the preview on this device. */
export function setPreview(theme: SiteTheme | null) {
  const d = document.documentElement;
  try { if (theme) localStorage.setItem(THEME_PREVIEW_KEY, theme); else localStorage.removeItem(THEME_PREVIEW_KEY); } catch { /* storage blocked */ }
  if (theme) d.setAttribute("data-theme-preview", theme); else d.removeAttribute("data-theme-preview");
  const shown = theme ?? APPROVED_THEME;
  // Clean White lives in :root; only the retired Ivory needs an override attribute.
  if (shown === "ivory") d.setAttribute("data-theme", "ivory"); else d.removeAttribute("data-theme");
  listeners.forEach((l) => l());
}

export function subscribePreview(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; }
