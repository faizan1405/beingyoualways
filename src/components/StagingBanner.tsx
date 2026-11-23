import { FlaskConical } from "lucide-react";

import { IS_STAGING } from "@/lib/site-env";

/** Thin strip on every page of the staging copy, so nobody mistakes it for the real store. */
export function StagingBanner() {
  if (!IS_STAGING) return null;
  return (
    <div
      role="note"
      className="flex items-center justify-center gap-2 bg-primary px-4 py-1.5 text-center text-xs font-medium text-primary-foreground"
    >
      <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        Staging copy — test orders only. No real payments, deliveries or customer messages.
      </span>
    </div>
  );
}
