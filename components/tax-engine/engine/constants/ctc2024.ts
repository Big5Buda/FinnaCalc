/**
 * 2024 Child Tax Credit / Credit for Other Dependents / Additional CTC.
 *
 * Source: Schedule 8812 (2024) and its instructions; IRC §24.
 * The $1,700 refundable cap per child for 2024 is from Rev. Proc. 2023-34 §2.06.
 */
import type { FilingStatus } from "../../types/filing"

export const CTC_2024 = {
  /** Maximum Child Tax Credit per qualifying child (under 17). */
  perChild: 2_000,
  /** Credit for Other Dependents (non-CTC dependents). */
  perOtherDependent: 500,
  /** Maximum REFUNDABLE Additional CTC per qualifying child (2024). */
  refundableCapPerChild: 1_700,
  /** Earned income above this amount counts toward the 15% ACTC formula. */
  earnedIncomeThreshold: 2_500,
  /** Refundable ACTC accrues at 15% of earned income over the threshold. */
  earnedIncomeRate: 0.15,
  /** Phaseout: credit drops $50 for each $1,000 (or fraction) of MAGI over the threshold. */
  phaseoutPer1000: 50,
  phaseoutIncrement: 1_000,
} as const

/** MAGI phaseout threshold where CTC/ODC begins to reduce. */
export const CTC_PHASEOUT_THRESHOLD_2024: Record<FilingStatus, number> = {
  single: 200_000,
  hoh: 200_000,
  mfs: 200_000,
  qss: 200_000,
  mfj: 400_000,
}
