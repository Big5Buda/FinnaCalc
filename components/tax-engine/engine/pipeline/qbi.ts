/**
 * Qualified Business Income deduction — §199A (Forms 8995 / 8995-A).
 *
 * Below the taxable-income threshold: simply 20% of QBI, capped at 20% of
 * (taxable income − net capital gain). Above the threshold an SSTB is phased out
 * over the next $50k ($100k MFJ); for a non-SSTB the W-2 wage / UBIA limit
 * applies — we don't track business W-2 wages, so the orchestrator flags this for
 * high earners rather than silently over-deducting.
 */
import type { FilingStatus } from "../../types/filing"
import { QBI_2024 } from "../constants/qbi2024"

export interface QbiResult {
  deduction: number
  /** True when a non-SSTB filer is over the threshold and the (untracked) W-2/UBIA limit could reduce the deduction. */
  wageLimitMayApply: boolean
}

export function computeQbiDeduction(params: {
  qbiIncome: number
  taxableIncomeBeforeQbi: number
  netCapitalGain: number
  isSSTB: boolean
  status: FilingStatus
}): QbiResult {
  const { qbiIncome, taxableIncomeBeforeQbi, netCapitalGain, isSSTB, status } = params
  if (qbiIncome <= 0) return { deduction: 0, wageLimitMayApply: false }

  const overallLimit = QBI_2024.rate * Math.max(0, taxableIncomeBeforeQbi - netCapitalGain)
  const threshold = QBI_2024.threshold[status]
  const range = QBI_2024.phaseInRange[status]

  // Below threshold: simple 20%, capped by the overall taxable-income limit.
  if (taxableIncomeBeforeQbi <= threshold) {
    return { deduction: Math.min(QBI_2024.rate * qbiIncome, overallLimit), wageLimitMayApply: false }
  }

  const over = taxableIncomeBeforeQbi - threshold

  if (isSSTB) {
    // Fully phased out at threshold + range.
    if (over >= range) return { deduction: 0, wageLimitMayApply: false }
    const applicablePct = 1 - over / range
    const deduction = Math.min(QBI_2024.rate * qbiIncome * applicablePct, overallLimit)
    return { deduction, wageLimitMayApply: false }
  }

  // Non-SSTB above threshold: the W-2/UBIA limit governs but isn't tracked here.
  return { deduction: Math.min(QBI_2024.rate * qbiIncome, overallLimit), wageLimitMayApply: true }
}
