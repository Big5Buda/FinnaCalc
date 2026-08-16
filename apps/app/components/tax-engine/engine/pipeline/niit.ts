/**
 * Net Investment Income Tax — 3.8% on the lesser of net investment income or the
 * amount of MAGI over the filing-status threshold (Form 8960).
 */
import type { FilingStatus } from "../../types/filing"
import { NIIT_2024 } from "../constants/filingThresholds2024"

export function computeNiit(
  netInvestmentIncome: number,
  magi: number,
  status: FilingStatus,
): number {
  const threshold = NIIT_2024.thresholds[status]
  const base = Math.min(Math.max(0, netInvestmentIncome), Math.max(0, magi - threshold))
  return base * NIIT_2024.rate
}
