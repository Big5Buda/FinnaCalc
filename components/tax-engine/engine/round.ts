/**
 * IRS rounding helpers.
 *
 * The IRS lets filers round to whole dollars: amounts under 50 cents round down,
 * 50 cents and over round up (away from zero for negatives). Apply `dollar()`
 * only at the 1040 line boundaries the IRS rounds at — keep cents internally.
 */

/** Round to a whole dollar, half away from zero (IRS convention). */
export function dollar(x: number): number {
  if (!Number.isFinite(x)) return 0
  return Math.sign(x) * Math.round(Math.abs(x))
}

/** Clamp to non-negative (many 1040 lines are floored at zero). */
export function nonNeg(x: number): number {
  return x > 0 ? x : 0
}

/** Sum a numeric field across a list. */
export function sumBy<T>(items: T[], fn: (item: T) => number): number {
  return items.reduce((acc, it) => acc + (fn(it) || 0), 0)
}
