/**
 * Pure mapping from a computed return to the neutral EfileBundle. (Real IRS MeF
 * submission is a large XML schema; this captures the summary a transmitter needs
 * and can be extended per provider.)
 */
import type { TaxCalculationResult } from "../../types/result"
import type { EfileBundle } from "./EfileProvider"

export function buildEfileBundle(result: TaxCalculationResult): EfileBundle {
  return {
    taxYear: 2024,
    filingStatus: result.filingStatus,
    agi: result.agi,
    taxableIncome: result.taxableIncome,
    totalTax: result.totalTax,
    totalPayments: result.totalPayments,
    refundOrOwed: result.refundOrOwed,
    state:
      result.state && result.state.supported && result.state.hasIncomeTax
        ? { code: result.state.code, tax: result.state.tax, refundOrOwed: result.state.refundOrOwed }
        : undefined,
    lines: result.trace.map((t) => ({ id: t.id, label: t.label, amount: t.amount })),
  }
}
