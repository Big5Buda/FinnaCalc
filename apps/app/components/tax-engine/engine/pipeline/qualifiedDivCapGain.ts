/**
 * Qualified Dividends and Capital Gain Tax Worksheet (Form 1040 line 16).
 *
 * Preferential income (qualified dividends + net long-term capital gain) is
 * STACKED ON TOP of ordinary-rate income and taxed at 0/15/20% using the 2024
 * breakpoints. Ordinary income is taxed first at regular rates. The final result
 * is floored at the all-ordinary tax (the worksheet's safety check), so electing
 * preferential treatment never costs more than ordinary rates.
 *
 * (28% collectibles gain and unrecaptured §1250 gain route to the Schedule D Tax
 * Worksheet — not yet modeled; the simpler worksheet is exact when those are zero.)
 */
import type { FilingStatus } from "../../types/filing"
import { CAP_GAIN_BREAKPOINTS_2024 } from "../constants/brackets2024"
import { computeRegularTax } from "./regularTax"
import { dollar } from "../round"

export interface QualDivResult {
  tax: number
  preferentialIncome: number
  amountAt0: number
  amountAt15: number
  amountAt20: number
}

/**
 * The 0/15/20% tax on `preferential` income stacked on top of `ordinaryBelow`.
 * Shared by the regular worksheet and the AMT computation (AMT uses the same
 * preferential capital-gains rates).
 */
export function preferentialStackTax(
  ordinaryBelow: number,
  preferential: number,
  status: FilingStatus,
): { tax: number; amountAt0: number; amountAt15: number; amountAt20: number } {
  const { zeroRateMax, fifteenRateMax } = CAP_GAIN_BREAKPOINTS_2024[status]
  const top = ordinaryBelow + preferential
  const amountAt0 = Math.max(0, Math.min(top, zeroRateMax) - ordinaryBelow)
  const amountAt15 = Math.max(
    0,
    Math.min(top, fifteenRateMax) - Math.max(ordinaryBelow, zeroRateMax),
  )
  const amountAt20 = Math.max(0, top - Math.max(ordinaryBelow, fifteenRateMax))
  return { tax: amountAt15 * 0.15 + amountAt20 * 0.2, amountAt0, amountAt15, amountAt20 }
}

/**
 * @param taxableIncome  Form 1040 line 15 (total taxable income).
 * @param qualifiedDividends  Qualified dividends (1099-DIV box 1b).
 * @param netCapitalGain  Net capital gain eligible for preferential rates.
 */
export function computeQualifiedDivCapGainTax(
  taxableIncome: number,
  qualifiedDividends: number,
  netCapitalGain: number,
  status: FilingStatus,
): QualDivResult {
  const ti = Math.max(0, taxableIncome)
  const preferential = Math.max(0, Math.min(qualifiedDividends + netCapitalGain, ti))
  const ordinary = Math.max(0, ti - preferential)

  const { tax: preferentialTax, amountAt0, amountAt15, amountAt20 } = preferentialStackTax(
    ordinary,
    preferential,
    status,
  )

  const ordinaryTax = computeRegularTax(ordinary, status).tax
  const stacked = ordinaryTax + preferentialTax

  // Safety floor: never more than taxing everything at ordinary rates.
  const allOrdinary = computeRegularTax(ti, status).tax
  const tax = dollar(Math.min(stacked, allOrdinary))

  return { tax, preferentialIncome: preferential, amountAt0, amountAt15, amountAt20 }
}
