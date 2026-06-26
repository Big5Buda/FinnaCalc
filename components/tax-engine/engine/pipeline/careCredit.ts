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
import { CARE_CREDIT_2024 } from "../constants/credits2024"
import { dollar } from "../round"

export function computeCareCredit(r: TaxReturn2024, agi: number): number {
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
    rate = Math.max(CARE_CREDIT_2024.minRate, CARE_CREDIT_2024.maxRate - steps * CARE_CREDIT_2024.rateStep)
  }

  return dollar(eligible * rate)
}
