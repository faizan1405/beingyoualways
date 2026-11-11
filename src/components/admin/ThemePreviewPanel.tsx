import { useSyncExternalStore } from "react";

import { Panel } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { APPROVED_THEME, THEMES, readPreview, setPreview, subscribePreview, type SiteTheme } from "@/lib/theme-preview";

const serverSnap = () => null;

/** Internal A/B theme comparison. Affects only this browser; shoppers keep the approved theme. */
export function ThemePreviewPanel() {
  const preview = useSyncExternalStore(subscribePreview, readPreview, serverSnap);
  return (
    <Panel title="Theme preview (internal)">
      <p className="text-sm text-muted-foreground">Compare the two options on this device only. Shoppers keep seeing <strong className="text-foreground">{THEMES[APPROVED_THEME].label}</strong> until the client picks a final theme.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(Object.keys(THEMES) as SiteTheme[]).map((t) => (
          <div key={t} className="rounded-lg border p-4">
            <p className="text-sm font-semibold">Option {THEMES[t].option} — {THEMES[t].label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{THEMES[t].note}</p>
            <Button className="mt-3" size="sm" variant={preview === t ? "default" : "outline"} onClick={() => setPreview(t)} aria-pressed={preview === t}>
              {preview === t ? "Previewing" : "Preview this theme"}
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {preview ? <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>End preview</Button> : <span>No preview active.</span>}
        <span>Shareable links: <code>/?theme=white</code> · <code>/?theme=ivory</code> · <code>/?theme=off</code></span>
      </div>
    </Panel>
  );
}
