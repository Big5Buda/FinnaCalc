/**
 * Education credits — Form 8863.
 *
 * AOTC: 100% of the first $2,000 + 25% of the next $2,000 (max $2,500) per
 * eligible student, 40% refundable. Lifetime Learning Credit: 20% of up to
 * $10,000 of expenses (aggregate, max $2,000), nonrefundable. Both phase out by
 * MAGI; MFS cannot claim either. A student claimed for AOTC isn't also counted
 * for LLC.
 */
import type { TaxReturn2024 } from "../../types/taxReturn"
import { EDUCATION_CREDITS_2024 } from "../constants/credits2024"
import { dollar } from "../round"

export interface EducationResult {
  nonrefundable: number
  refundable: number
}

export function computeEducationCredits(r: TaxReturn2024, magi: number): EducationResult {
  if (!r.credits.hasEducationExpenses || r.filingStatus === "mfs") {
    return { nonrefundable: 0, refundable: 0 }
  }

  const phase = EDUCATION_CREDITS_2024.phaseout[r.filingStatus]
  const factor =
    magi <= phase.start ? 1 : magi >= phase.end ? 0 : (phase.end - magi) / (phase.end - phase.start)
  if (factor <= 0) return { nonrefundable: 0, refundable: 0 }

  const a = EDUCATION_CREDITS_2024.aotc
  let aotc = 0
  let llcExpenses = 0
  for (const s of r.credits.students) {
    const aotcEligible = s.aotcEligible && s.priorAotcYears < a.maxPriorYears && !s.felonyDrugConviction
    if (aotcEligible) {
      const first = Math.min(s.qualifiedExpenses, a.firstTier)
      const second = Math.min(Math.max(0, s.qualifiedExpenses - first), a.secondTier) * a.secondTierRate
      aotc += Math.min(first + second, a.max)
    } else {
      llcExpenses += Math.max(0, s.qualifiedExpenses)
    }
  }

  const llc = Math.min(
    Math.min(llcExpenses, EDUCATION_CREDITS_2024.llc.expenseCap) * EDUCATION_CREDITS_2024.llc.rate,
    EDUCATION_CREDITS_2024.llc.max,
  )

  const aotcAfter = aotc * factor
  const llcAfter = llc * factor

  const refundable = dollar(aotcAfter * a.refundablePortion)
  const nonrefundable = dollar(aotcAfter * (1 - a.refundablePortion) + llcAfter)
  return { nonrefundable, refundable }
}
