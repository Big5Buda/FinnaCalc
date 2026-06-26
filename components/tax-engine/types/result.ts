/**
 * Output of the pure calculation engine. Every meaningful 1040 line is exposed,
 * plus a `trace[]` that the Review screen and tests read line-by-line.
 */
import type { FilingStatus, StateCode } from "./filing"

/** One line in the computed return — drives the Review screen and golden tests. */
export interface LineTrace {
  /** Stable key, e.g. "agi", "regularTax", "ctc". */
  id: string
  /** Human label, e.g. "Adjusted gross income". */
  label: string
  /** IRS form/line reference, e.g. "Form 1040, line 11". */
  formRef: string
  /** Dollar amount (whole dollars after IRS rounding). */
  amount: number
}

/** A user-facing warning for a path the engine does not fully model. */
export interface Warning {
  code: string
  message: string
}

/** An audit-risk / data-quality flag surfaced in the UI. */
export interface AuditFlag {
  severity: "info" | "warn" | "high"
  message: string
  /** Related trace line id, if any. */
  relatedLine?: string
}

/** The MAGI variants different rules require (they are NOT all the same number). */
export interface MagiBreakdown {
  niit: number
  ira: number
  studentLoan: number
  ptc: number
  ctc: number
  aotc: number
}

/** State result (absent for federal-only or states not yet supported). */
export interface StateResult {
  code: StateCode
  name: string
  /** False for no-income-tax states (TX, FL, WA, TN, …). */
  hasIncomeTax: boolean
  /** False when the state isn't in the supported set yet (tax left at 0). */
  supported: boolean
  stateAgi: number
  taxableIncome: number
  tax: number
  withheld: number
  /** Positive = refund; negative = balance due. */
  refundOrOwed: number
  note?: string
}

export interface TaxCalculationResult {
  filingStatus: FilingStatus

  // Income & AGI
  totalIncome: number
  totalAdjustments: number
  agi: number
  magi: MagiBreakdown

  // Deductions
  standardDeduction: number
  itemizedDeduction: number
  deductionUsed: "standard" | "itemized"
  deductionAmount: number
  /** Extra tax saved by itemizing vs standard (0 if standard chosen). */
  itemizedSavings: number

  // QBI & taxable income
  qbiDeduction: number
  taxableIncomeBeforeQbi: number
  taxableIncome: number

  // Tax computation
  regularTax: number
  usedTaxTable: boolean
  usedQualDivWorksheet: boolean
  amt: number
  additionalMedicareTax: number
  niit: number
  seTax: number

  // Credits
  nonrefundableCredits: Record<string, number>
  totalNonrefundableCredits: number
  refundableCredits: Record<string, number>
  totalRefundableCredits: number

  // Totals
  otherTaxes: number
  totalTax: number
  totalPayments: number
  /** Positive = refund; negative = balance due. */
  refundOrOwed: number
  owes: boolean
  underpaymentPenalty: number

  // Rates
  marginalRate: number
  effectiveRate: number

  // Carryovers & diagnostics
  capitalLossCarryover: { shortTerm: number; longTerm: number }
  trace: LineTrace[]
  warnings: Warning[]
  auditFlags: AuditFlag[]

  // State (optional)
  state?: StateResult
}
