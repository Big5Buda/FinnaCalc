/**
 * Child Tax Credit, Credit for Other Dependents, and the refundable Additional
 * Child Tax Credit — Schedule 8812 (2024).
 *
 * Flow:
 *  1. Tentative credit = $2,000 × qualifying children + $500 × other dependents.
 *  2. MAGI phaseout: −$50 per $1,000 (or fraction) over the threshold.
 *  3. Nonrefundable part = min(credit after phaseout, tax available).
 *  4. ACTC (refundable) = min(leftover credit, $1,700 × qualifying children,
 *     15% × (earned income − $2,500)). ODC is never refundable.
 *
 * The 3-or-more-children Social-Security-tax alternative for ACTC is added in
 * Phase 3; the 15% earned-income method governs the common case.
 */
import type { TaxReturn2024 } from "../../types/taxReturn"
import { CTC_2024, CTC_PHASEOUT_THRESHOLD_2024 } from "../constants/ctc2024"
import { nonNeg } from "../round"

export interface ChildTaxCreditResult {
  qualifyingChildren: number
  otherDependents: number
  tentativeCredit: number
  creditAfterPhaseout: number
  /** Nonrefundable CTC/ODC actually applied against tax. */
  nonrefundable: number
  /** Refundable Additional Child Tax Credit. */
  additionalChildTaxCredit: number
}

export function computeChildTaxCredit(
  r: TaxReturn2024,
  magi: number,
  taxAvailable: number,
  earnedIncome: number,
): ChildTaxCreditResult {
  const qualifyingChildren = r.dependents.filter((d) => d.qualifiesForCTC).length
  const otherDependents = r.dependents.filter((d) => d.qualifiesForODC).length

  const tentativeCredit =
    qualifyingChildren * CTC_2024.perChild + otherDependents * CTC_2024.perOtherDependent

  // MAGI phaseout — excess rounded UP to the next $1,000 before applying $50.
  const threshold = CTC_PHASEOUT_THRESHOLD_2024[r.filingStatus]
  let creditAfterPhaseout = tentativeCredit
  if (magi > threshold) {
    const steps = Math.ceil((magi - threshold) / CTC_2024.phaseoutIncrement)
    creditAfterPhaseout = nonNeg(tentativeCredit - steps * CTC_2024.phaseoutPer1000)
  }

  // Nonrefundable part limited to tax available.
  const nonrefundable = Math.min(creditAfterPhaseout, nonNeg(taxAvailable))

  // Refundable ACTC on the leftover (qualifying children only).
  const leftover = nonNeg(creditAfterPhaseout - nonrefundable)
  const refundableCap = qualifyingChildren * CTC_2024.refundableCapPerChild
  const earnedFormula = nonNeg(
    (earnedIncome - CTC_2024.earnedIncomeThreshold) * CTC_2024.earnedIncomeRate,
  )
  const additionalChildTaxCredit = Math.min(leftover, refundableCap, earnedFormula)

  return {
    qualifyingChildren,
    otherDependents,
    tentativeCredit,
    creditAfterPhaseout,
    nonrefundable,
    additionalChildTaxCredit,
  }
}
