import { Outlet, createFileRoute, useLocation } from "@tanstack/react-router";

import { CartDrawer } from "@/components/site/CartDrawer";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ThemePreviewBar } from "@/components/site/ThemePreviewBar";

export const Route = createFileRoute("/_site")({
  component: SiteLayout,
});

function SiteLayout() {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-card focus:p-3">Skip to content</a>
      <SiteHeader />
      <main id="main" key={pathname} className="page-enter flex-1 overflow-x-clip">
        <Outlet />
      </main>
      <SiteFooter />
      <CartDrawer />
      <ThemePreviewBar />
    </div>
  );
}
