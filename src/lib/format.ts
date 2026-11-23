export const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Server amounts are integer paise; shows paise only when there are any (₹1,234 / ₹1,234.50). */
export const inrPaise = (p: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: p % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(p / 100);
