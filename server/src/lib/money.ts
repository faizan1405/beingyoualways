import { Prisma } from "@prisma/client";

// All store money is calculated in integer paise. Database columns are DECIMAL(10,2) rupees,
// so conversion happens only at the database edge and is exact for whole paise.

export type Paise = number;

export const isPaise = (n: unknown): n is Paise => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;

/** Decimal rupees (database) → integer paise. */
export function toPaise(d: Prisma.Decimal | number | string | null | undefined): Paise {
  if (d == null) return 0;
  return new Prisma.Decimal(d).mul(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
}

/** Integer paise → Decimal rupees for a DECIMAL(10,2) column. */
export function fromPaise(p: Paise): Prisma.Decimal {
  if (!Number.isSafeInteger(p)) throw new Error("Amounts must be whole paise.");
  return new Prisma.Decimal(p).div(100);
}

/** ₹1,234.50 style label for logs and timelines. */
export const formatInr = (p: Paise) =>
  `₹${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: p % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;

/** Percentage of an amount, rounded half-up to the paisa. `percent` may have up to 2 decimals. */
export function percentOf(amount: Paise, percent: number): Paise {
  const basisPoints = Math.round(percent * 100);
  return Math.floor((amount * basisPoints + 5_000) / 10_000);
}
