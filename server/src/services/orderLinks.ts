import { createHmac, timingSafeEqual } from "node:crypto";

// Private order-status links: token = HMAC(ORDER_LINK_SECRET, order number). Nothing to store,
// and a repeated checkout submission can be answered with the same link.
export function orderToken(secret: string, orderNumber: string): string {
  return createHmac("sha256", secret).update(`order:${orderNumber}`).digest("base64url");
}
export function checkOrderToken(secret: string, orderNumber: string, token: string): boolean {
  const a = Buffer.from(orderToken(secret, orderNumber));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
