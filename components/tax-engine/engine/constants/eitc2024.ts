/**
 * Earned Income Tax Credit — 2024 parameters.
 *
 * Source: Rev. Proc. 2023-34 §2.06. The IRS publishes an EITC table, but it is
 * the $50-bucket evaluation of this piecewise-linear formula:
 *   phase-in:  rate × earned income (up to the maximum credit)
 *   plateau:   the maximum credit
 *   phase-out: maximum − phaseoutRate × (income − phaseout threshold)
 * Non-MFJ thresholds; MFJ adds the marriage bump to the phase-out threshold.
 */
export interface EitcBracket {
  /** Earned income at which the maximum credit is reached (phase-in ceiling). */
  earnedIncomeAmount: number
  maxCredit: number
  phaseInRate: number
  phaseoutRate: number
  /** Phase-out start (AGI/earned income) for non-MFJ filers. */
  phaseoutThreshold: number
  /** Phase-out start for MFJ filers. */
  phaseoutThresholdMfj: number
}

/** Indexed by number of qualifying children (0, 1, 2, 3 = "3 or more"). */
export const EITC_2024: EitcBracket[] = [
  {
    earnedIncomeAmount: 8_260,
    maxCredit: 632,
    phaseInRate: 0.0765,
    phaseoutRate: 0.0765,
    phaseoutThreshold: 10_330,
    phaseoutThresholdMfj: 17_250,
  },
  {
    earnedIncomeAmount: 12_390,
    maxCredit: 4_213,
    phaseInRate: 0.34,
    phaseoutRate: 0.1598,
    phaseoutThreshold: 22_720,
    phaseoutThresholdMfj: 29_640,
  },
  {
    earnedIncomeAmount: 17_400,
    maxCredit: 6_960,
    phaseInRate: 0.4,
    phaseoutRate: 0.2106,
    phaseoutThreshold: 22_720,
    phaseoutThresholdMfj: 29_640,
  },
  {
    earnedIncomeAmount: 17_400,
    maxCredit: 7_830,
    phaseInRate: 0.45,
    phaseoutRate: 0.2106,
    phaseoutThreshold: 22_720,
    phaseoutThresholdMfj: 29_640,
  },
]

/** Disqualifying investment income limit (2024). */
export const EITC_INVESTMENT_INCOME_LIMIT_2024 = 11_600

/** Age bounds for the childless EITC (at least 25, under 65). */
export const EITC_CHILDLESS_AGE = { min: 25, maxExclusive: 65 } as const
