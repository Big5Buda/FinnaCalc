import { EITC_INCOME_LIMIT_2026, EITC_INCOME_LIMIT_MFJ_2026 } from "../constants/changes2026"
import { taxRules, type TaxYear } from "../constants/taxRules"
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

import { dollar } from "../round"

/** Credit amount at a given income level for a bracket (piecewise-linear formula). */
function eitcAtIncome(income: number, bracketIndex: number, status: FilingStatus, year: TaxYear = 2024): number {
  const { EITC_2024, EITC_INVESTMENT_INCOME_LIMIT_2024, EITC_CHILDLESS_AGE } = taxRules(year)

  if (income <= 0) return 0
  if (year === 2026) {
    const b = EITC_2024[bracketIndex]
    const limit = (status === "mfj" ? EITC_INCOME_LIMIT_MFJ_2026 : EITC_INCOME_LIMIT_2026)[bracketIndex]
    if (income < 1 || income >= limit) return 0
    const threshold = status === "mfj" ? b.phaseoutThresholdMfj : b.phaseoutThreshold
    const lower = Math.floor(income/50)*50, upper = Math.min(lower+50,limit)
    if (upper > b.earnedIncomeAmount && lower < threshold) return b.maxCredit
    const midpoint = (lower+upper)/2
    return midpoint <= threshold ? Math.min(b.maxCredit,b.phaseInRate*midpoint) : Math.max(0,b.maxCredit-b.phaseoutRate*(midpoint-threshold))
  }
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
  spouseAge?: number
}): EitcResult {
  const { EITC_2024, EITC_INVESTMENT_INCOME_LIMIT_2024, EITC_CHILDLESS_AGE } = taxRules(params.r.meta.taxYear)

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
  if (r.meta.taxYear === 2026 && bracketIndex === 0) {
    const ageOK = (a?: number) => a !== undefined && a >= 25 && a < 65
    if (r.filingStatus === "mfs" || r.taxpayer.claimedAsDependentByAnother || (r.filingStatus === "mfj" && r.spouse?.claimedAsDependentByAnother)) return { credit: 0, eligible: false, disqualReason: "The childless EITC eligibility rules are not met." }
    if (!ageOK(taxpayerAge) && !(r.filingStatus === "mfj" && ageOK(params.spouseAge))) return { credit: 0, eligible: false, disqualReason: "Enter an eligible filer's age to include childless EITC." }
  }


  // Childless filers must be 25–64; only enforced when age is known.
  if (
    bracketIndex === 0 &&
    r.meta.taxYear !== 2026 && taxpayerAge !== undefined &&
    (taxpayerAge < EITC_CHILDLESS_AGE.min || taxpayerAge >= EITC_CHILDLESS_AGE.maxExclusive)
  ) {
    return { credit: 0, eligible: false, disqualReason: "Childless EITC requires age 25–64." }
  }

  const threshold = status === "mfj"
    ? EITC_2024[bracketIndex].phaseoutThresholdMfj
    : EITC_2024[bracketIndex].phaseoutThreshold

  const byEarned = eitcAtIncome(earnedIncome, bracketIndex, status, r.meta.taxYear)
  const credit = agi <= threshold ? byEarned : Math.min(byEarned, eitcAtIncome(agi, bracketIndex, status, r.meta.taxYear))

  return { credit: dollar(credit), eligible: credit > 0 }
}
