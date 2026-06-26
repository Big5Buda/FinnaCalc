/**
 * State tax module types. A config-driven engine: each state supplies its 2024
 * brackets, standard deduction, and exemptions; a generic computation applies them
 * starting from federal AGI (with the common Social Security / retirement
 * subtractions). State-specific subtractions, itemizing, and credits beyond these
 * are simplified — each state carries a `note` describing the estimate's limits.
 */
import type { FilingStatus, StateCode } from "../../types/filing"

export interface StateBracket {
  rate: number
  min: number
  max: number
}

export interface StateInput {
  code: StateCode | ""
  /** Federal AGI from the federal computation. */
  federalAgi: number
  /** Taxable Social Security included in federal AGI (subtracted by most states). */
  taxableSocialSecurity: number
  /** Taxable retirement/pension distributions (subtracted by states that exclude them). */
  retirementDistributions: number
  filingStatus: FilingStatus
  /** Number of dependents claimed. */
  dependents: number
  /** State income tax withheld (W-2 box 17 + any extra). */
  stateWithholding: number
  age65: boolean
}

export interface StateConfig {
  code: StateCode
  name: string
  hasIncomeTax: boolean
  /** Brackets per filing status (use the builders to share across statuses). */
  brackets?: Record<FilingStatus, StateBracket[]>
  standardDeduction?: Record<FilingStatus, number>
  /** Per-person deduction (taxpayer + spouse). */
  personalExemption?: number
  /** Per-dependent deduction. */
  dependentExemption?: number
  /** Per-person credit applied against tax (e.g. California). */
  exemptionCredit?: number
  /** Per-dependent credit applied against tax (e.g. California). */
  dependentExemptionCredit?: number
  /** Whether the state taxes Social Security benefits (all 15 here: false). */
  taxesSocialSecurity?: boolean
  /** Whether the state excludes retirement/pension income (IL, PA). */
  excludesRetirement?: boolean
  note?: string
}
