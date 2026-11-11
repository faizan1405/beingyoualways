import { useEffect, useState } from "react";

import type { Product } from "@/lib/types";
import { productService, selectHighDemand } from "@/services/productService";

/**
 * Homepage High Demand list. Starts from the route loader's data, then follows the
 * browser's demo product store so admin mark/unmark shows up without a reload.
 * `ready` is false until the browser copy has been read (avoids an empty-state flash).
 */
export function useHighDemand(initial: Product[]) {
  const [list, setList] = useState(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => setList(selectHighDemand(productService.peekAll()));
    sync();
    setReady(true);
    return productService.subscribe(sync);
  }, []);
  return { list, ready };
}
