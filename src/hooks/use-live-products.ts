import { useEffect, useState } from "react";

import type { Product } from "@/lib/types";
import { productService } from "@/services/productService";

// Server rendering only knows the imported catalogue; admin demo edits live in this
// browser. These hooks start from the loader data and switch to the browser copy after
// mount (and on later edits), so photos/sizes saved in admin show on every page.

/** Same products as `initial`, refreshed from the browser store; hidden ones drop out. */
export function useLiveProducts(initial: Product[], select?: (all: Product[]) => Product[]) {
  const [list, setList] = useState(initial);
  const ids = initial.map((p) => p.id).join("|");
  useEffect(() => {
    const sync = () => {
      if (!productService.hasLiveData()) return; // live mode: keep loader data until the server list arrives
      const all = productService.peekAll();
      setList(select ? select(all) : initial.flatMap((p) => all.filter((x) => x.id === p.id && x.status === "active")));
    };
    sync();
    return productService.subscribe(sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);
  return list;
}

/** One product, refreshed from the browser store (keeps the loader copy if it was removed). */
export function useLiveProduct(initial: Product) {
  const [p, setP] = useState(initial);
  useEffect(() => {
    setP(initial);
    const sync = () => { const x = productService.peekAll().find((y) => y.id === initial.id && y.status === "active"); if (x) setP(x); };
    sync();
    return productService.subscribe(sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id]);
  return p;
}
