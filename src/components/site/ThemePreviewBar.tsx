import { useSyncExternalStore } from "react";
import { X } from "lucide-react";

import { THEMES, readPreview, setPreview, subscribePreview, type SiteTheme } from "@/lib/theme-preview";
import { cn } from "@/lib/utils";

const serverSnap = () => null;

/** Floating A/B switch — only rendered on a device that opened a theme preview. */
export function ThemePreviewBar() {
  const preview = useSyncExternalStore(subscribePreview, readPreview, serverSnap);
  if (!preview) return null;
  return (
    <div role="region" aria-label="Theme preview" className="fixed bottom-24 left-3 z-40 flex items-center gap-1 rounded-full border bg-card/95 p-1 text-xs shadow-lift backdrop-blur md:bottom-5 md:left-5">
      <span className="px-2 font-semibold uppercase tracking-[0.14em] text-muted-foreground">Theme</span>
      {(Object.keys(THEMES) as SiteTheme[]).map((t) => (
        <button key={t} type="button" aria-pressed={preview === t} onClick={() => setPreview(t)}
          className={cn("min-h-9 rounded-full px-3 font-medium btn-motion", preview === t ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary")}>
          <span className="sr-only sm:not-sr-only">Option </span>{THEMES[t].option}<span className="hidden sm:inline"> · {THEMES[t].label}</span><span className="sr-only sm:hidden"> {THEMES[t].label}</span>
        </button>
      ))}
      <button type="button" onClick={() => setPreview(null)} aria-label="End theme preview" className="grid size-9 place-items-center rounded-full text-muted-foreground btn-motion hover:bg-secondary hover:text-foreground">
        <X className="size-4" />
      </button>
    </div>
  );
}
