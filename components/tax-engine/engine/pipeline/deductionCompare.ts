/**
 * Standard vs itemized deduction (Form 1040 line 12; Schedule A).
 *
 * Computes the full standard deduction (base + age-65/blind additions, with the
 * dependent cap) and a Schedule A itemized total (medical 7.5% floor, SALT cap,
 * mortgage interest, charitable AGI limits), then picks the larger — unless the
 * return forces itemizing (e.g. an MFS spouse who itemized).
 */
import type { TaxReturn2024 } from "../../types/taxReturn"
import type { FilingStatus } from "../../types/filing"
import {
  ADDITIONAL_STD_DEDUCTION_2024,
  DEPENDENT_STD_DEDUCTION_2024,
  STANDARD_DEDUCTION_2024,
  isMarriedStatus,
} from "../constants/standardDeductions2024"
import {
  CHARITABLE_LIMITS_2024,
  MEDICAL_AGI_FLOOR_2024,
  MORTGAGE_DEBT_LIMIT_2024,
  SALT_CAP_2024,
} from "../constants/filingThresholds2024"
import { computeRegularTax } from "./regularTax"
import { nonNeg } from "../round"

/** For TY2024, a person is treated as 65+ if born before January 2, 1960. */
export function isConsidered65For2024(dateOfBirth: string): boolean {
  if (!dateOfBirth) return false
  const dob = new Date(dateOfBirth)
  if (Number.isNaN(dob.getTime())) return false
  // Born on or before 1960-01-01 → considered 65 by year-end 2024.
  return dob.getTime() <= new Date("1960-01-01T00:00:00Z").getTime()
}

/** Count the age-65/blind "boxes" that drive the additional standard deduction. */
function countAdditionalBoxes(r: TaxReturn2024): number {
  let boxes = 0
  if (isConsidered65For2024(r.taxpayer.dateOfBirth)) boxes++
  if (r.taxpayer.blind) boxes++
  // Spouse's boxes count for MFJ / QSS (and MFS only in narrow cases not modeled here).
  if ((r.filingStatus === "mfj" || r.filingStatus === "qss") && r.spouse) {
    if (isConsidered65For2024(r.spouse.dateOfBirth)) boxes++
    if (r.spouse.blind) boxes++
  }
  return boxes
}

export function computeStandardDeduction(r: TaxReturn2024, earnedIncome: number): number {
  const status = r.filingStatus
  const base = STANDARD_DEDUCTION_2024[status]
  const additionalPerBox = isMarriedStatus(status)
    ? ADDITIONAL_STD_DEDUCTION_2024.married
    : ADDITIONAL_STD_DEDUCTION_2024.unmarried
  const additional = countAdditionalBoxes(r) * additionalPerBox

  // Dependent standard-deduction cap: limited to the greater of $1,300 or
  // (earned income + $450), but never more than the regular base.
  let baseDeduction = base
  if (r.taxpayer.claimedAsDependentByAnother) {
    const limited = Math.max(
      DEPENDENT_STD_DEDUCTION_2024.floor,
      earnedIncome + DEPENDENT_STD_DEDUCTION_2024.earnedIncomeBump,
    )
    baseDeduction = Math.min(base, limited)
  }

  return baseDeduction + additional
}

export function computeItemizedDeduction(r: TaxReturn2024, agi: number): number {
  const it = r.itemized
  const status = r.filingStatus

  const medical = nonNeg(it.medicalExpenses - agi * MEDICAL_AGI_FLOOR_2024)

  const saltRaw =
    it.stateLocalIncomeOrSalesTax + it.realEstateTaxes + it.personalPropertyTaxes
  const saltCap = status === "mfs" ? SALT_CAP_2024.mfs : SALT_CAP_2024.standard
  const salt = Math.min(saltRaw, saltCap)

  // Mortgage interest: limited to the acquisition-debt cap. When the loan
  // balance exceeds the limit, only the proportional share of interest is
  // deductible ($750k for loans after 12/15/2017, $1M grandfathered; halved MFS).
  const mortgageLimit = it.mortgageAfterDec2017
    ? status === "mfs"
      ? MORTGAGE_DEBT_LIMIT_2024.postDec2017Mfs
      : MORTGAGE_DEBT_LIMIT_2024.postDec2017
    : status === "mfs"
      ? MORTGAGE_DEBT_LIMIT_2024.grandfatheredMfs
      : MORTGAGE_DEBT_LIMIT_2024.grandfathered
  const mortgage =
    it.mortgageBalance > mortgageLimit
      ? nonNeg(it.mortgageInterest) * (mortgageLimit / it.mortgageBalance)
      : nonNeg(it.mortgageInterest)

  const charitableCash = Math.min(it.charitableCash, agi * CHARITABLE_LIMITS_2024.cashPctOfAgi)
  const charitableNonCash = Math.min(
    it.charitableNonCash,
    agi * CHARITABLE_LIMITS_2024.nonCashPctOfAgi,
  )

  const casualty = nonNeg(it.casualtyLosses)

  return medical + salt + mortgage + charitableCash + charitableNonCash + casualty
}

export interface DeductionResult {
  standard: number
  itemized: number
  used: "standard" | "itemized"
  amount: number
  /** Federal tax saved by the chosen deduction vs the alternative (estimate). */
  itemizedSavings: number
}

export function computeDeduction(
  r: TaxReturn2024,
  agi: number,
  earnedIncome: number,
): DeductionResult {
  const status: FilingStatus = r.filingStatus
  const standard = computeStandardDeduction(r, earnedIncome)
  const itemized = computeItemizedDeduction(r, agi)

  const useItemized = r.forceItemize || itemized > standard
  const used: "standard" | "itemized" = useItemized ? "itemized" : "standard"
  const amount = used === "itemized" ? itemized : standard

  // Estimate the tax difference between the two deductions (ignoring QBI /
  // preferential rates, which Phase 1 doesn't apply) for the optimizer display.
  const taxStandard = computeRegularTax(nonNeg(agi - standard), status).tax
  const taxItemized = computeRegularTax(nonNeg(agi - itemized), status).tax
  const itemizedSavings = nonNeg(taxStandard - taxItemized)

  return { standard, itemized, used, amount, itemizedSavings }
}
