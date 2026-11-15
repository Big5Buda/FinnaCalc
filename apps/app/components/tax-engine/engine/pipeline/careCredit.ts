import { taxRules, type TaxYear } from "../constants/taxRules"
/**
 * Child & Dependent Care Credit — Form 2441 (nonrefundable).
 *
 * Eligible expenses are limited to $3,000 (one qualifying person) or $6,000 (two
 * or more), reduced by any employer dependent-care benefits, and capped at the
 * taxpayer's (and spouse's, if MFJ) earned income. The credit rate runs from 35%
 * (AGI ≤ $15,000) down to 20% (AGI > $43,000). MFS who lived with their spouse
 * cannot claim it.
 */
import type { TaxReturn2024 } from "../../types/taxReturn"

import { dollar } from "../round"

export function computeCareCredit(r: TaxReturn2024, agi: number): number {
  const { CARE_CREDIT_2024 } = taxRules(r.meta.taxYear)

  if (!r.credits.hasCareExpenses) return 0
  if (r.filingStatus === "mfs" && !r.livedApartFromSpouse) return 0

  const qualifyingPersons = r.dependents.filter((d) => d.qualifiesForCareCredit).length
  if (qualifyingPersons === 0) return 0

  const cap =
    qualifyingPersons === 1
      ? CARE_CREDIT_2024.expenseCapOnePerson
      : CARE_CREDIT_2024.expenseCapTwoPlus
  const care = r.credits.care
  const effectiveCap = Math.max(0, cap - Math.max(0, care.employerBenefits))

  const earnedLimit =
    r.filingStatus === "mfj"
      ? Math.min(care.taxpayerEarnedIncome, care.spouseEarnedIncome)
      : care.taxpayerEarnedIncome

  const eligible = Math.min(Math.max(0, care.expenses), effectiveCap, earnedLimit)
  if (eligible <= 0) return 0

  let rate: number = CARE_CREDIT_2024.maxRate
  if (agi > CARE_CREDIT_2024.fullRateAgiCeiling) {
    const steps = Math.ceil(
      (agi - CARE_CREDIT_2024.fullRateAgiCeiling) / CARE_CREDIT_2024.rateStepIncome,
    )
    rate = Math.max(r.meta.taxYear === 2026 ? 0.35 : CARE_CREDIT_2024.minRate, CARE_CREDIT_2024.maxRate - steps * CARE_CREDIT_2024.rateStep)
    if (r.meta.taxYear === 2026) {
      const threshold = r.filingStatus === "mfj" ? 150_000 : 75_000
      const step = r.filingStatus === "mfj" ? 4_000 : 2_000
      if (agi > threshold) rate = Math.max(CARE_CREDIT_2024.minRate, 0.35 - Math.ceil((agi - threshold)/step)*CARE_CREDIT_2024.rateStep)
    }
  }

  return dollar(eligible * rate)
}
