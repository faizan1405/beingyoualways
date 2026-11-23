import { createFileRoute } from "@tanstack/react-router";

import { ROBOTS_TXT, SITE_ENV } from "@/lib/site-env";

// The real store keeps its open robots.txt; a staging build tells every crawler to stay out.
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(ROBOTS_TXT[SITE_ENV], {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        }),
    },
  },
});
