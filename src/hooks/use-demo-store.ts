import { useSyncExternalStore } from "react";

import type { DemoStore } from "@/lib/demo-store";
import type { Product } from "@/lib/types";
import { contentStore, type SiteContent } from "@/services/contentService";
import { productService } from "@/services/productService";

/** Live value of a demo store. Server render + hydration use the seed, then the saved copy. */
export function useDemoStore<T>(store: DemoStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.server);
}

/** Storefront content edited in Admin → Website content. */
export const useSiteContent = (): SiteContent => useDemoStore(contentStore);

/** Every product incl. hidden ones (admin), live from the browser copy. */
export const useAllProducts = (): Product[] => useSyncExternalStore(productService.subscribe, productService.peekAll, productService.seedAll);
