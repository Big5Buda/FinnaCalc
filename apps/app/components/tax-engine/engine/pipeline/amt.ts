import { taxRules, type TaxYear } from "../constants/taxRules"
/**
 * Alternative Minimum Tax — Form 6251 (simplified).
 *
 * AMTI = taxable income (after QBI) + add-backs (the SALT itemized deduction, or
 * the standard deduction if not itemizing). The AMT exemption phases out at 25%
 * of AMTI over the threshold. The tentative minimum tax applies 26%/28% to the
 * ordinary portion of the base and the regular 0/15/20% rates to preferential
 * income. AMT = max(0, TMT − regular tax).
 *
 * Other AMT preferences (ISO exercise, depletion, private-activity bond interest)
 * are not tracked; this captures the common SALT/standard-deduction driver.
 */
import type { FilingStatus } from "../../types/filing"

import { preferentialStackTax } from "./qualifiedDivCapGain"
import { dollar } from "../round"

export interface AmtResult {
  amt: number
  tentativeMinimumTax: number
  amti: number
  exemption: number
}

export function computeAmt(params: {
  taxableIncome: number
  addBacks: number
  preferentialIncome: number
  regularTax: number
  status: FilingStatus
  taxYear?: TaxYear
}): AmtResult {
  const { AMT_2024 } = taxRules(params.taxYear ?? 2024)

  const { taxableIncome, addBacks, preferentialIncome, regularTax, status } = params
  let amti = Math.max(0, taxableIncome + addBacks)
  if (params.taxYear === 2026 && status === "mfs") {
    const start = AMT_2024.exemptionPhaseoutThreshold.mfs + AMT_2024.exemption.mfs / AMT_2024.exemptionPhaseoutRate
    amti += Math.min(AMT_2024.exemption.mfs, Math.max(0, amti - start) * AMT_2024.exemptionPhaseoutRate)
  }

  const fullExemption = AMT_2024.exemption[status]
  const phaseStart = AMT_2024.exemptionPhaseoutThreshold[status]
  const exemption =
    amti > phaseStart
      ? Math.max(0, fullExemption - AMT_2024.exemptionPhaseoutRate * (amti - phaseStart))
      : fullExemption

  const base = Math.max(0, amti - exemption)
  const pref = Math.max(0, Math.min(preferentialIncome, base))
  const ordinaryBase = base - pref

  const bk = status === "mfs" ? AMT_2024.rate28ThresholdMfs : AMT_2024.rate28Threshold
  const ordinaryTmt =
    ordinaryBase <= bk
      ? ordinaryBase * AMT_2024.lowRate
      : bk * AMT_2024.lowRate + (ordinaryBase - bk) * AMT_2024.highRate
  const prefTmt = preferentialStackTax(ordinaryBase, pref, status, params.taxYear ?? 2024).tax

  const tentativeMinimumTax = dollar(ordinaryTmt + prefTmt)
  return {
    amt: Math.max(0, tentativeMinimumTax - regularTax),
    tentativeMinimumTax,
    amti,
    exemption,
  }
}
