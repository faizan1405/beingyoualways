// Private order-status links. The token lives in the page address after "#", so it is never sent to
// any server log or analytics; this tab also remembers it (sessionStorage) so a refresh keeps working.
// No names, addresses or payment details are stored in the browser.
const KEY = "bya.orderLinks.v1";

const read = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  try { const v = JSON.parse(sessionStorage.getItem(KEY) ?? "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
};

export function rememberOrderLink(orderNumber: string, token: string) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...read(), [orderNumber]: token })); } catch { /* private mode: the link in the address still works */ }
}
export const recalledOrderToken = (orderNumber: string): string | null => read()[orderNumber] ?? null;
export const tokenFromHash = (hash: string): string | null => {
  const m = /(?:^|[#&])t=([A-Za-z0-9_-]{20,100})/.exec(hash);
  return m ? m[1]! : null;
};
export const orderHash = (token: string) => `t=${token}`;
