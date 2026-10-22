/**
 * Centralised currency utility.
 *
 * - All amounts in the database are integers in the MINOR unit of the BASE currency
 *   (kobo for NGN). This is exactly what Paystack expects, so no float maths is ever
 *   sent to the payment gateway.
 * - The DISPLAY currency can be switched to USD with NEXT_PUBLIC_DISPLAY_CURRENCY;
 *   amounts are then converted with NEXT_PUBLIC_NGN_PER_USD purely for display.
 * - To add a currency, add an entry to CURRENCIES and (if needed) a rate in convertMinor().
 */

export type CurrencyCode = "NGN" | "USD";

interface CurrencyMeta {
  code: CurrencyCode;
  symbol: string;
  locale: string;
  minorUnits: number; // how many minor units in one major unit
  label: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  NGN: { code: "NGN", symbol: "₦", locale: "en-NG", minorUnits: 100, label: "Nigerian Naira" },
  USD: { code: "USD", symbol: "$", locale: "en-US", minorUnits: 100, label: "US Dollar" },
};

function asCurrency(value: string | undefined, fallback: CurrencyCode): CurrencyCode {
  return value === "NGN" || value === "USD" ? value : fallback;
}

export const BASE_CURRENCY: CurrencyCode = asCurrency(process.env.NEXT_PUBLIC_BASE_CURRENCY, "NGN");
export const DISPLAY_CURRENCY: CurrencyCode = asCurrency(process.env.NEXT_PUBLIC_DISPLAY_CURRENCY, BASE_CURRENCY);
const NGN_PER_USD = Number(process.env.NEXT_PUBLIC_NGN_PER_USD || "1550") || 1550;

/** Convert major units (e.g. 1500.50 Naira) to minor units (150050 kobo). */
export function toMinor(major: number, currency: CurrencyCode = BASE_CURRENCY): number {
  return Math.round(major * CURRENCIES[currency].minorUnits);
}

/** Convert minor units (kobo) to major units (Naira). */
export function fromMinor(minor: number, currency: CurrencyCode = BASE_CURRENCY): number {
  return minor / CURRENCIES[currency].minorUnits;
}

/** Convert an amount in minor units between currencies. */
export function convertMinor(minor: number, from: CurrencyCode, to: CurrencyCode): number {
  if (from === to) return minor;
  if (from === "NGN" && to === "USD") return Math.round(minor / NGN_PER_USD);
  if (from === "USD" && to === "NGN") return Math.round(minor * NGN_PER_USD);
  return minor;
}

interface FormatOptions {
  currency?: CurrencyCode;
  /** Hide the decimals when the amount is a whole number (default true). */
  compact?: boolean;
}

/**
 * Format an amount stored in BASE-currency minor units for display.
 * formatMoney(12500000) -> "₦125,000"
 */
export function formatMoney(amountMinor: number, options: FormatOptions = {}): string {
  const target = options.currency ?? DISPLAY_CURRENCY;
  const compact = options.compact ?? true;
  const converted = convertMinor(amountMinor, BASE_CURRENCY, target);
  const meta = CURRENCIES[target];
  const major = converted / meta.minorUnits;
  const hasFraction = Math.round(major * 100) % 100 !== 0;
  const digits = compact && !hasFraction ? 0 : 2;
  const number = new Intl.NumberFormat(meta.locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(major);
  return `${meta.symbol}${number}`;
}

/** Display-currency symbol, e.g. for input prefixes. */
export const currencySymbol = CURRENCIES[DISPLAY_CURRENCY].symbol;
