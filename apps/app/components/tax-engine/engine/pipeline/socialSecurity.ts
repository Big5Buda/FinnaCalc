/**
 * Taxable portion of Social Security benefits — IRS Social Security Benefits
 * Worksheet (closed form).
 *
 * Provisional ("combined") income = all other income + tax-exempt interest +
 * ½ of benefits − certain above-the-line adjustments (Schedule 1 lines 11–20,
 * 23, 25; NOTABLY excluding student loan interest, line 21). Then:
 *   - ≤ base1:        none taxable
 *   - base1..base2:   min(50% of excess over base1, 50% of benefits)
 *   - > base2:        min(85% of excess over base2 + tier1, 85% of benefits)
 * where tier1 = min(50% of benefits, 50% of (base2 − base1)).
 */
import type { FilingStatus } from "../../types/filing"
import { SS_TAXABILITY_2024, ssBaseAmounts } from "../constants/socialSecurity2024"

export function computeTaxableSocialSecurity(params: {
  benefits: number
  otherIncome: number
  taxExemptInterest: number
  /** Schedule 1 lines 11–20, 23, 25 (excludes student loan interest). */
  adjustmentsForProvisional: number
  status: FilingStatus
  livedApartFromSpouse: boolean
}): number {
  const { benefits, otherIncome, taxExemptInterest, adjustmentsForProvisional, status } = params
  if (benefits <= 0) return 0

  const half = SS_TAXABILITY_2024.firstTierRate * benefits
  const provisional =
    otherIncome + taxExemptInterest + half - adjustmentsForProvisional
  const { base1, base2 } = ssBaseAmounts(status, params.livedApartFromSpouse)

  if (provisional <= base1) return 0

  if (provisional <= base2) {
    return Math.min(
      SS_TAXABILITY_2024.firstTierRate * (provisional - base1),
      half,
    )
  }

  const tier1 = Math.min(half, SS_TAXABILITY_2024.firstTierRate * (base2 - base1))
  return Math.min(
    SS_TAXABILITY_2024.maxInclusionRate * (provisional - base2) + tier1,
    SS_TAXABILITY_2024.maxInclusionRate * benefits,
  )
}
