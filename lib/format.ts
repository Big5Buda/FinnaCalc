/**
 * Shared display formatters for FinnaCalc.
 *
 * Single home for the project's currency/percent display conventions so the
 * tax engine UI (and any other surface) renders money identically everywhere.
 * These are presentation-only helpers — never use them inside the calculation
 * engine, which works in raw numbers.
 */

/** Format a number as USD, e.g. 1234.5 -> "$1,234.50". */
export function formatCurrency(
  value: number,
  opts: { cents?: boolean } = {},
): string {
  const { cents = true } = opts
  const safe = Number.isFinite(value) ? value : 0
  return `$${safe.toLocaleString(undefined, {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  })}`
}

/** Format a signed number as USD with an explicit +/- sign. */
export function formatSignedCurrency(value: number): string {
  const safe = Number.isFinite(value) ? value : 0
  const sign = safe < 0 ? "-" : "+"
  return `${sign}${formatCurrency(Math.abs(safe))}`
}

/** Format a ratio (0.225) or a whole percent depending on `asRatio`. */
export function formatPercent(value: number, digits = 1): string {
  const safe = Number.isFinite(value) ? value : 0
  return `${safe.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`
}
