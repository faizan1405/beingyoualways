import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useEffect } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { classifyLoadError } from "@/lib/load-error";
import { reportLovableError } from "@/lib/lovable-error-reporting";

const COPY = {
  offline: { title: "The store can't be reached right now", body: "Our shop server isn't answering at the moment. Nothing has been lost — please try again in a few minutes." },
  server: { title: "The store had a problem loading this page", body: "Our shop server ran into a problem. Nothing has been lost — please try again in a moment." },
  not_connected: { title: "The store isn't connected yet", body: "This page needs the shop server, which hasn't been connected yet." },
  unknown: { title: "This page didn't load", body: "Something went wrong on our end. You can try again or head back home." },
} as const;

/** Shown inside the storefront layout when a page's data can't be loaded — header and footer stay. */
export function PageLoadError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const kind = classifyLoadError(error);
  useEffect(() => {
    if (kind === "unknown") reportLovableError(error, { boundary: "tanstack_route_error_component" });
  }, [error, kind]);
  const copy = COPY[kind];
  return (
    <section className="bg-page">
      <div className="container-lux grid min-h-[55vh] place-items-center py-16 text-center">
        <div className="max-w-md">
          <h1 className="text-4xl">{copy.title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{copy.body}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={() => { void router.invalidate(); reset(); }} className="gap-2">
              <RefreshCw className="h-4 w-4" aria-hidden /> Try again
            </Button>
            <a href="/" className={buttonVariants({ variant: "outline" })}>Go home</a>
          </div>
        </div>
      </div>
    </section>
  );
}
