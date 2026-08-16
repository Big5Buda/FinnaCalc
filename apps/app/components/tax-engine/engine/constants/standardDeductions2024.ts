/**
 * 2024 standard deduction amounts.
 *
 * Source: Rev. Proc. 2023-34 §2.15; 2024 Form 1040 instructions
 * "Standard Deduction Chart" and "Standard Deduction Worksheet for Dependents".
 */
import type { FilingStatus } from "../../types/filing"

/** Base standard deduction by filing status. */
export const STANDARD_DEDUCTION_2024: Record<FilingStatus, number> = {
  single: 14_600,
  mfj: 29_200,
  qss: 29_200,
  mfs: 14_600,
  hoh: 21_900,
}

/**
 * Additional standard deduction per "box" checked (age 65+ and/or blind).
 * Unmarried (single, HOH) get the larger amount; married statuses the smaller.
 */
export const ADDITIONAL_STD_DEDUCTION_2024 = {
  unmarried: 1_950, // single, hoh
  married: 1_550, // mfj, mfs, qss
} as const

/** Dependent standard deduction floor and earned-income bump (2024). */
export const DEPENDENT_STD_DEDUCTION_2024 = {
  /** Minimum standard deduction for someone claimed as a dependent. */
  floor: 1_300,
  /** Earned income plus this amount (capped at the regular standard deduction). */
  earnedIncomeBump: 450,
} as const

/** Returns true if the filing status uses the "married" additional-amount. */
export function isMarriedStatus(status: FilingStatus): boolean {
  return status === "mfj" || status === "mfs" || status === "qss"
}
