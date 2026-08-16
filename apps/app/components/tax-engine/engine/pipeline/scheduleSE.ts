/**
 * Self-employment tax — Schedule SE.
 *
 * Net earnings = net SE profit × 92.35%. If under $400, no SE tax. The 12.4%
 * Social Security portion applies up to the wage base, REDUCED by W-2 Social
 * Security wages already taxed (so a high W-2 earner with a side business doesn't
 * pay SS tax twice). The 2.9% Medicare portion has no cap. Computed per person.
 * Half of the total SE tax is deductible above the line (Schedule 1 line 15).
 */
import { SE_TAX_2024 } from "../constants/filingThresholds2024"

export interface SeTaxResult {
  seTax: number
  deduction: number
  /** Net SE earnings (after the 92.35% factor) — used by QBI later. */
  netEarnings: number
}

type Owner = "taxpayer" | "spouse"

export function computeSelfEmploymentTax(
  netSeByOwner: Record<Owner, number>,
  w2SsWagesByOwner: Record<Owner, number>,
): SeTaxResult {
  let seTax = 0
  let netEarnings = 0

  for (const owner of ["taxpayer", "spouse"] as Owner[]) {
    const net = netSeByOwner[owner]
    if (net <= 0) continue
    const earnings = net * SE_TAX_2024.netEarningsFactor
    if (earnings < 400) continue
    netEarnings += earnings

    const ssWageRemaining = Math.max(
      0,
      SE_TAX_2024.socialSecurityWageBase - (w2SsWagesByOwner[owner] || 0),
    )
    const ssBase = Math.min(earnings, ssWageRemaining)
    const ssPortion = ssBase * SE_TAX_2024.socialSecurityRate
    const medicarePortion = earnings * SE_TAX_2024.medicareRate
    seTax += ssPortion + medicarePortion
  }

  return {
    seTax,
    deduction: seTax * SE_TAX_2024.deductibleFraction,
    netEarnings,
  }
}
