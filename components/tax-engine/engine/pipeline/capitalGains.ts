/**
 * Capital gains & losses — Schedule D / Form 8949.
 *
 * Nets short-term and long-term transactions (plus long-term capital gain
 * distributions from 1099-DIV box 2a and any prior-year carryovers), applies the
 * $3,000 ($1,500 MFS) annual loss-deduction limit, and computes:
 *  - includedInIncome: the amount that flows to Form 1040 (a gain, or the
 *    allowed loss as a negative).
 *  - preferentialLTCG: "net capital gain" (net LT gain reduced by net ST loss),
 *    the amount eligible for 0/15/20% rates.
 *  - carryover: short- and long-term loss carried to next year.
 *
 * Carryover character follows the Schedule D Capital Loss Carryover Worksheet
 * (the allowed loss is applied to short-term first, then long-term).
 */
import type { TaxReturn2024 } from "../../types/taxReturn"
import { CAPITAL_LOSS_LIMIT_2024 } from "../constants/filingThresholds2024"
import { sumBy } from "../round"

export interface CapitalGainsResult {
  netShortTerm: number
  netLongTerm: number
  totalNet: number
  includedInIncome: number
  preferentialLTCG: number
  allowedLoss: number
  carryoverShort: number
  carryoverLong: number
}

const EMPTY: CapitalGainsResult = {
  netShortTerm: 0,
  netLongTerm: 0,
  totalNet: 0,
  includedInIncome: 0,
  preferentialLTCG: 0,
  allowedLoss: 0,
  carryoverShort: 0,
  carryoverLong: 0,
}

export function computeCapitalGains(r: TaxReturn2024): CapitalGainsResult {
  const f = r.income.flags
  if (!f.hasCapitalGains && !f.hasDividends) return EMPTY

  const transactions = f.hasCapitalGains ? r.income.f1099B : []
  let st = 0
  let lt = 0
  for (const t of transactions) {
    // A wash-sale adjustment adds a disallowed loss back (reduces the loss).
    const gain = t.proceeds - t.costBasis + (t.washSaleAdjustment || 0)
    if (t.longTerm) lt += gain
    else st += gain
  }

  // Long-term capital gain distributions (1099-DIV box 2a) flow to Schedule D.
  if (f.hasDividends) {
    lt += sumBy(r.income.f1099Div, (d) => d.box2aCapitalGainDistributions)
  }

  // Prior-year carryovers (stored as positive loss amounts) reduce this year.
  if (f.hasCapitalGains) {
    st -= r.income.capitalLossCarryoverShort
    lt -= r.income.capitalLossCarryoverLong
  }

  const netShortTerm = st
  const netLongTerm = lt
  const totalNet = netShortTerm + netLongTerm

  if (totalNet >= 0) {
    // Net gain — "net capital gain" is the long-term portion not offset by ST loss.
    const preferentialLTCG = netLongTerm > 0 ? Math.min(netLongTerm, totalNet) : 0
    return {
      ...EMPTY,
      netShortTerm,
      netLongTerm,
      totalNet,
      includedInIncome: totalNet,
      preferentialLTCG,
    }
  }

  // Net loss — limited deduction this year, remainder carries over.
  const limit = CAPITAL_LOSS_LIMIT_2024[r.filingStatus]
  const allowedLoss = Math.min(limit, Math.abs(totalNet))

  // Carryover character (allowed loss applied to short-term first).
  let carryoverShort = 0
  let carryoverLong = 0
  let remainingAllowed = allowedLoss
  if (netShortTerm < 0) {
    const stLoss = -netShortTerm
    const ltGain = Math.max(0, netLongTerm)
    carryoverShort = Math.max(0, stLoss - ltGain - allowedLoss)
    const usedAgainstSt = Math.min(allowedLoss, Math.max(0, stLoss - ltGain))
    remainingAllowed = allowedLoss - usedAgainstSt
  }
  if (netLongTerm < 0) {
    const ltLoss = -netLongTerm
    const stGain = Math.max(0, netShortTerm)
    carryoverLong = Math.max(0, ltLoss - stGain - remainingAllowed)
  }

  return {
    netShortTerm,
    netLongTerm,
    totalNet,
    includedInIncome: -allowedLoss,
    preferentialLTCG: 0,
    allowedLoss,
    carryoverShort,
    carryoverLong,
  }
}
