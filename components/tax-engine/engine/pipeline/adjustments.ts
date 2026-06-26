/**
 * Above-the-line adjustments (Schedule 1 Part II) → reduce income to AGI.
 *
 * Some adjustments are "fixed" (independent of AGI): educator, HSA, SE-tax 50%
 * deduction, self-employed health insurance, and SEP/SIMPLE. Two are MAGI-
 * dependent and therefore resolved inside the orchestrator's fixed-point loop
 * (because their MAGI includes taxable Social Security): the traditional IRA
 * deduction and the student loan interest deduction.
 */
import type { TaxReturn2024 } from "../../types/taxReturn"
import type { FilingStatus } from "../../types/filing"
import {
  EDUCATOR_EXPENSE_2024,
  STUDENT_LOAN_INTEREST_2024,
} from "../constants/filingThresholds2024"
import { HSA_2024, IRA_2024 } from "../constants/retirement2024"
import { isConsidered65For2024 } from "./deductionCompare"

/** Age 55+ at end of 2024 (HSA catch-up) → born on/before 1969-12-31. */
function isAge55For2024(dateOfBirth: string): boolean {
  if (!dateOfBirth) return false
  const dob = new Date(dateOfBirth)
  if (Number.isNaN(dob.getTime())) return false
  return dob.getTime() <= new Date("1969-12-31T00:00:00Z").getTime()
}

/** Age 50+ at end of 2024 (IRA catch-up) → born on/before 1974-12-31. */
function isAge50For2024(dateOfBirth: string): boolean {
  if (!dateOfBirth) return false
  const dob = new Date(dateOfBirth)
  if (Number.isNaN(dob.getTime())) return false
  return dob.getTime() <= new Date("1974-12-31T00:00:00Z").getTime()
}

/** Educator expense — capped at $300 (per-educator); MFJ-both is Phase-later. */
export function educatorDeduction(r: TaxReturn2024): number {
  return Math.min(Math.max(0, r.adjustments.educatorExpenses), EDUCATOR_EXPENSE_2024.perEducator)
}

/** HSA deduction (Form 8889) — capped by the coverage limit plus 55+ catch-up. */
export function hsaDeduction(r: TaxReturn2024): number {
  const cov = r.adjustments.hsaCoverage
  if (cov === "none") return 0
  let limit = cov === "family" ? HSA_2024.family : HSA_2024.selfOnly
  if (isAge55For2024(r.taxpayer.dateOfBirth)) limit += HSA_2024.catchUp
  return Math.min(Math.max(0, r.adjustments.hsaContribution), limit)
}

/** Self-employed health insurance — limited to available net SE profit. */
export function seHealthDeduction(
  r: TaxReturn2024,
  totalNetSe: number,
  seTaxDeduction: number,
  sepContribution: number,
): number {
  const ceiling = Math.max(0, totalNetSe - seTaxDeduction - Math.max(0, sepContribution))
  return Math.min(Math.max(0, r.adjustments.selfEmployedHealthInsurance), ceiling)
}

/**
 * Traditional IRA deduction with the 2024 MAGI phaseout. Only phases out if the
 * contributor is an active workplace-plan participant (or, for MFJ, the spouse is).
 * A non-zero phased deduction is rounded UP to $10 and floored at $200.
 */
export function iraDeduction(
  contribution: number,
  magi: number,
  status: FilingStatus,
  coveredByPlan: boolean,
  spouseCoveredByPlan: boolean,
  age50: boolean,
): number {
  const limit = age50 ? IRA_2024.contributionLimitAge50 : IRA_2024.contributionLimit
  const eligible = Math.min(Math.max(0, contribution), limit)
  if (eligible <= 0) return 0

  let range: { start: number; end: number } | null = null
  if (coveredByPlan) {
    if (status === "mfj" || status === "qss") range = IRA_2024.phaseout.coveredMfj
    else if (status === "mfs") range = IRA_2024.phaseout.coveredMfs
    else range = IRA_2024.phaseout.coveredSingleHoh
  } else if ((status === "mfj" || status === "qss") && spouseCoveredByPlan) {
    range = IRA_2024.phaseout.spouseCoveredMfj
  } else if (status === "mfs" && spouseCoveredByPlan) {
    range = IRA_2024.phaseout.coveredMfs
  }

  // No coverage that triggers a phaseout → fully deductible.
  if (!range) return eligible

  if (magi <= range.start) return eligible
  if (magi >= range.end) return 0

  const ratio = (range.end - magi) / (range.end - range.start)
  let deduction = eligible * ratio
  deduction = Math.ceil(deduction / IRA_2024.roundUpTo) * IRA_2024.roundUpTo
  if (deduction > 0 && deduction < IRA_2024.minPhasedDeduction) deduction = IRA_2024.minPhasedDeduction
  return Math.min(deduction, eligible)
}

/** Student loan interest deduction with the 2024 MAGI phaseout (MFS ineligible). */
export function studentLoanInterestDeduction(
  paid: number,
  magi: number,
  status: FilingStatus,
): number {
  if (status === "mfs") return 0
  const eligible = Math.min(Math.max(0, paid), STUDENT_LOAN_INTEREST_2024.maxDeduction)
  if (eligible <= 0) return 0
  const { start, end } = STUDENT_LOAN_INTEREST_2024.phaseout[status]
  if (magi <= start) return eligible
  if (magi >= end) return 0
  return eligible - eligible * ((magi - start) / (end - start))
}

export { isAge50For2024 }
