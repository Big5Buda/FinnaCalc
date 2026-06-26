/**
 * 2024 ordinary income tax rate schedules (Tax Year 2024, filed in 2025).
 *
 * Source: Rev. Proc. 2023-34 §2.01; 2024 Form 1040 Tax Rate Schedules /
 * 1040-ES (2024). Each bracket is [min, max) of TAXABLE income at `rate`.
 * QSS (qualifying surviving spouse) uses the MFJ schedule.
 */
import type { FilingStatus } from "../../types/filing"

export interface Bracket {
  /** Marginal rate as a decimal (0.22 = 22%). */
  rate: number
  /** Lower bound of taxable income for this bracket (inclusive). */
  min: number
  /** Upper bound of taxable income for this bracket (exclusive); Infinity for the top. */
  max: number
}

const SINGLE: Bracket[] = [
  { rate: 0.1, min: 0, max: 11_600 },
  { rate: 0.12, min: 11_600, max: 47_150 },
  { rate: 0.22, min: 47_150, max: 100_525 },
  { rate: 0.24, min: 100_525, max: 191_950 },
  { rate: 0.32, min: 191_950, max: 243_725 },
  { rate: 0.35, min: 243_725, max: 609_350 },
  { rate: 0.37, min: 609_350, max: Infinity },
]

const MFJ: Bracket[] = [
  { rate: 0.1, min: 0, max: 23_200 },
  { rate: 0.12, min: 23_200, max: 94_300 },
  { rate: 0.22, min: 94_300, max: 201_050 },
  { rate: 0.24, min: 201_050, max: 383_900 },
  { rate: 0.32, min: 383_900, max: 487_450 },
  { rate: 0.35, min: 487_450, max: 731_200 },
  { rate: 0.37, min: 731_200, max: Infinity },
]

const MFS: Bracket[] = [
  { rate: 0.1, min: 0, max: 11_600 },
  { rate: 0.12, min: 11_600, max: 47_150 },
  { rate: 0.22, min: 47_150, max: 100_525 },
  { rate: 0.24, min: 100_525, max: 191_950 },
  { rate: 0.32, min: 191_950, max: 243_725 },
  { rate: 0.35, min: 243_725, max: 365_600 },
  { rate: 0.37, min: 365_600, max: Infinity },
]

const HOH: Bracket[] = [
  { rate: 0.1, min: 0, max: 16_550 },
  { rate: 0.12, min: 16_550, max: 63_100 },
  { rate: 0.22, min: 63_100, max: 100_500 },
  { rate: 0.24, min: 100_500, max: 191_950 },
  { rate: 0.32, min: 191_950, max: 243_700 },
  { rate: 0.35, min: 243_700, max: 609_350 },
  { rate: 0.37, min: 609_350, max: Infinity },
]

export const ORDINARY_BRACKETS_2024: Record<FilingStatus, Bracket[]> = {
  single: SINGLE,
  mfj: MFJ,
  qss: MFJ, // QSS uses the MFJ schedule
  mfs: MFS,
  hoh: HOH,
}

/**
 * 2024 long-term capital gains / qualified dividends rate breakpoints.
 * Source: Rev. Proc. 2023-34 §2.03. Values are the TAXABLE-income thresholds
 * where the 0%->15% and 15%->20% rates begin.
 */
export interface CapGainBreakpoints {
  /** At/below this taxable income, preferential rate is 0%. */
  zeroRateMax: number
  /** Above `zeroRateMax` up to this amount, preferential rate is 15%; above is 20%. */
  fifteenRateMax: number
}

export const CAP_GAIN_BREAKPOINTS_2024: Record<FilingStatus, CapGainBreakpoints> = {
  single: { zeroRateMax: 47_025, fifteenRateMax: 518_900 },
  mfj: { zeroRateMax: 94_050, fifteenRateMax: 583_750 },
  qss: { zeroRateMax: 94_050, fifteenRateMax: 583_750 },
  mfs: { zeroRateMax: 47_025, fifteenRateMax: 291_850 },
  hoh: { zeroRateMax: 63_000, fifteenRateMax: 551_350 },
}
