import { Link } from "@tanstack/react-router";
import { CloudOff } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Production build without VITE_API_BASE_URL: no demo admin, no sample data — just say so. */
export function StoreNotConnected() {
  return (
    <div data-admin className="grid min-h-screen place-items-center bg-secondary/50 p-4">
      <div role="alert" className="max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-soft">
        <CloudOff className="mx-auto size-8 text-destructive" />
        <p className="mt-3 font-serif text-2xl">Store server not connected</p>
        <p className="mt-2 text-sm text-muted-foreground">This build of the website isn't connected to the Hostinger store server (VITE_API_BASE_URL is not set), so the admin is switched off. No demo data is shown in production.</p>
        <Button className="mt-5" variant="lux" asChild><Link to="/">Back to the shop</Link></Button>
      </div>
    </div>
  );
}

