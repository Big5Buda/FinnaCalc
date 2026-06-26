/**
 * Retirement & HSA contribution/deduction limits — 2024.
 *
 * Sources: Rev. Proc. 2023-23 (HSA, Form 8889); Notice 2023-75 / IRS 2024
 * limits (IRA); IRC §219(g) (IRA deduction phaseout). Phaseout ranges are MAGI.
 */
import type { FilingStatus } from "../../types/filing"

/** Traditional IRA contribution limits and deduction phaseouts. */
export const IRA_2024 = {
  contributionLimit: 7_000,
  /** Age 50+ catch-up brings the limit to $8,000. */
  contributionLimitAge50: 8_000,
  /** MAGI phaseout ranges (only apply if the contributor is an active plan participant,
   *  or — for the spouse range — if the non-covered spouse's covered partner triggers it). */
  phaseout: {
    coveredSingleHoh: { start: 77_000, end: 87_000 },
    coveredMfj: { start: 123_000, end: 143_000 },
    /** Contributor NOT covered, but spouse IS covered (MFJ). */
    spouseCoveredMfj: { start: 230_000, end: 240_000 },
    coveredMfs: { start: 0, end: 10_000 },
  },
  /** Special floor: a non-zero phased-out deduction is at least $200, rounded up to $10. */
  minPhasedDeduction: 200,
  roundUpTo: 10,
} as const

/** HSA contribution limits (Form 8889). */
export const HSA_2024 = {
  selfOnly: 4_150,
  family: 8_300,
  /** Age 55+ catch-up. */
  catchUp: 1_000,
  catchUpAge: 55,
} as const
