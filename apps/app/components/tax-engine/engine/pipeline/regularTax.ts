/**
 * Regular income tax (Form 1040 line 16, ordinary-income path).
 *
 * For taxable income under $100,000 the IRS REQUIRES the Tax Table, which taxes
 * the midpoint of a $50 bucket — this differs from the straight bracket formula
 * by a few dollars. At/above $100,000 the Tax Computation Worksheet applies the
 * rate schedule directly. Both are implemented here.
 *
 * (Qualified dividends / long-term capital gains use a separate worksheet added
 * in Phase 2; this module is the ordinary-income computation.)
 */
import type { FilingStatus } from "../../types/filing"
import { ORDINARY_BRACKETS_2024 } from "../constants/brackets2024"
import { dollar } from "../round"

/** Tax from the rate schedule (exact, in cents) on a positive amount. */
export function bracketTax(amount: number, status: FilingStatus): number {
  if (amount <= 0) return 0
  let tax = 0
  for (const b of ORDINARY_BRACKETS_2024[status]) {
    if (amount > b.min) {
      const upper = Math.min(amount, b.max)
      tax += (upper - b.min) * b.rate
    }
  }
  return tax
}

/** The marginal rate that applies at a given taxable income. */
export function marginalRate(taxableIncome: number, status: FilingStatus): number {
  let rate = 0
  for (const b of ORDINARY_BRACKETS_2024[status]) {
    if (taxableIncome > b.min) rate = b.rate
  }
  return rate
}

/**
 * The IRS Tax Table taxes the midpoint of a $50 bucket. Below $50 the table uses
 * irregular small rows: $0–5, $5–15, $15–25, $25–50. Returns the income amount
 * the bracket formula should be applied to.
 */
function taxTableBasis(ti: number): number {
  if (ti < 5) return 2.5
  if (ti < 15) return 10
  if (ti < 25) return 20
  if (ti < 50) return 37.5
  return Math.floor(ti / 50) * 50 + 25
}

export interface RegularTaxResult {
  tax: number
  usedTaxTable: boolean
  marginalRate: number
}

/** Compute regular tax on ordinary taxable income (Tax Table vs Computation Worksheet). */
export function computeRegularTax(
  taxableIncome: number,
  status: FilingStatus,
): RegularTaxResult {
  const ti = taxableIncome > 0 ? taxableIncome : 0
  const mr = marginalRate(ti, status)
  if (ti < 100_000) {
    return {
      tax: dollar(bracketTax(taxTableBasis(ti), status)),
      usedTaxTable: true,
      marginalRate: mr,
    }
  }
  return { tax: dollar(bracketTax(ti, status)), usedTaxTable: false, marginalRate: mr }
}
