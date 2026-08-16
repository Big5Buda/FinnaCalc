/**
 * Earned Income Tax Credit — Schedule EIC (refundable).
 *
 * The credit is figured from BOTH earned income and AGI; if AGI exceeds the
 * phase-out threshold, the smaller of the two results is used. Disqualifiers:
 * investment income over $11,600; MFS who did not live apart from their spouse;
 * and (childless only) being outside the 25–64 age band.
 */
import type { TaxReturn2024 } from "../../types/taxReturn"
import type { FilingStatus } from "../../types/filing"
import { EITC_2024, EITC_INVESTMENT_INCOME_LIMIT_2024, EITC_CHILDLESS_AGE } from "../constants/eitc2024"
import { dollar } from "../round"

/** Credit amount at a given income level for a bracket (piecewise-linear formula). */
function eitcAtIncome(income: number, bracketIndex: number, status: FilingStatus): number {
  if (income <= 0) return 0
  const b = EITC_2024[bracketIndex]
  const threshold = status === "mfj" ? b.phaseoutThresholdMfj : b.phaseoutThreshold
  const phaseIn = Math.min(b.maxCredit, b.phaseInRate * income)
  if (income <= threshold) return phaseIn
  return Math.max(0, b.maxCredit - b.phaseoutRate * (income - threshold))
}

export interface EitcResult {
  credit: number
  eligible: boolean
  disqualReason?: string
}

export function computeEitc(params: {
  r: TaxReturn2024
  earnedIncome: number
  agi: number
  investmentIncome: number
  taxpayerAge?: number
}): EitcResult {
  const { r, earnedIncome, agi, investmentIncome, taxpayerAge } = params
  const status = r.filingStatus

  // MFS is eligible only if the taxpayer lived apart from their spouse.
  if (status === "mfs" && !r.livedApartFromSpouse) {
    return { credit: 0, eligible: false, disqualReason: "MFS filers must have lived apart from their spouse." }
  }
  if (investmentIncome > EITC_INVESTMENT_INCOME_LIMIT_2024) {
    return {
      credit: 0,
      eligible: false,
      disqualReason: `Investment income over $${EITC_INVESTMENT_INCOME_LIMIT_2024.toLocaleString()} disqualifies the EITC.`,
    }
  }
  if (earnedIncome <= 0) return { credit: 0, eligible: false }

  const qualifyingChildren = r.dependents.filter((d) => d.qualifiesForEITC).length
  const bracketIndex = Math.min(qualifyingChildren, 3)

  // Childless filers must be 25–64; only enforced when age is known.
  if (
    bracketIndex === 0 &&
    taxpayerAge !== undefined &&
    (taxpayerAge < EITC_CHILDLESS_AGE.min || taxpayerAge >= EITC_CHILDLESS_AGE.maxExclusive)
  ) {
    return { credit: 0, eligible: false, disqualReason: "Childless EITC requires age 25–64." }
  }

  const threshold = status === "mfj"
    ? EITC_2024[bracketIndex].phaseoutThresholdMfj
    : EITC_2024[bracketIndex].phaseoutThreshold

  const byEarned = eitcAtIncome(earnedIncome, bracketIndex, status)
  const credit = agi <= threshold ? byEarned : Math.min(byEarned, eitcAtIncome(agi, bracketIndex, status))

  return { credit: dollar(credit), eligible: credit > 0 }
}
