/**
 * Premium Tax Credit reconciliation — Form 8962 (simplified).
 *
 * Compares the allowed PTC against advance payments. A net positive is a
 * refundable credit; a net negative is excess advance PTC that must be repaid.
 * NOTE: the income-based repayment limitation (which caps the repayment for
 * filers under 400% of the federal poverty line) is NOT modeled — the
 * orchestrator surfaces a warning so the figure is treated as an estimate.
 */
import type { TaxReturn2024 } from "../../types/taxReturn"
import { dollar } from "../round"

export interface PtcResult {
  netRefundable: number
  repayment: number
}

export function computePremiumTaxCredit(r: TaxReturn2024): PtcResult {
  if (!r.credits.hasMarketplaceCoverage) return { netRefundable: 0, repayment: 0 }
  const net = r.credits.premiumTaxCreditAllowed - r.credits.advancePremiumTaxCredit
  if (net >= 0) return { netRefundable: dollar(net), repayment: 0 }
  return { netRefundable: 0, repayment: dollar(-net) }
}
