/**
 * Social Security benefit taxability — 2024.
 *
 * Source: IRC §86; 2024 Form 1040 instructions "Social Security Benefits
 * Worksheet"; IRS Pub 915. Base amounts are NOT inflation-indexed (fixed since
 * 1993). Up to 85% of benefits can be taxable.
 */
import type { FilingStatus } from "../../types/filing"

export const SS_TAXABILITY_2024 = {
  maxInclusionRate: 0.85,
  firstTierRate: 0.5,
} as const

/**
 * Base amounts (worksheet lines 8 and 11):
 *  - base1: below this, no benefits are taxable.
 *  - base2: above this, the 85% tier applies.
 * MFS taxpayers who lived WITH their spouse use $0/$0 (almost always 85% taxable).
 */
export function ssBaseAmounts(
  status: FilingStatus,
  livedApartFromSpouse: boolean,
): { base1: number; base2: number } {
  if (status === "mfj") return { base1: 32_000, base2: 44_000 }
  if (status === "mfs" && !livedApartFromSpouse) return { base1: 0, base2: 0 }
  // single, hoh, qss, and mfs-who-lived-apart-all-year
  return { base1: 25_000, base2: 34_000 }
}
