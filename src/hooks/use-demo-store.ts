import { useSyncExternalStore } from "react";

import type { DemoStore } from "@/lib/demo-store";
import type { Product } from "@/lib/types";
import { isBackendConfigured } from "@/services/api";
import { contentStore, type SiteContent } from "@/services/contentService";
import { liveContentStore } from "@/services/liveContent";
import { productService } from "@/services/productService";

/** Live value of a demo store. Server render + hydration use the seed, then the saved copy. */
export function useDemoStore<T>(store: DemoStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.server);
}

/** Storefront content edited in Admin → Website content (server copy when the backend is connected). */
export const useSiteContent = (): SiteContent => {
  const demo = useDemoStore(contentStore);
  const live = useSyncExternalStore(liveContentStore.subscribe, liveContentStore.get, liveContentStore.server);
  return isBackendConfigured() ? live : demo;
};

/** Every product incl. hidden ones (admin), live from the browser copy. */
export const useAllProducts = (): Product[] => useSyncExternalStore(productService.subscribe, productService.peekAll, productService.seedAll);
