/**
 * Miscellaneous 2024 thresholds shared across pipeline steps.
 * Sources cited per constant. (Phase 1 uses the capital-loss limit; the SE /
 * Medicare / NIIT values are wired in Phases 2-3.)
 */
import type { FilingStatus } from "../../types/filing"

/** Self-employment tax (Schedule SE). Source: 2024 Schedule SE; SSA wage base. */
export const SE_TAX_2024 = {
  /** Net earnings multiplier (Schedule SE line 4a): 92.35%. */
  netEarningsFactor: 0.9235,
  /** Social Security portion rate (12.4%). */
  socialSecurityRate: 0.124,
  /** Medicare portion rate (2.9%). */
  medicareRate: 0.029,
  /** 2024 Social Security wage base (max earnings subject to the 12.4%). */
  socialSecurityWageBase: 168_600,
  /** Deductible fraction of SE tax (above-the-line). */
  deductibleFraction: 0.5,
} as const

/** Additional Medicare Tax (Form 8959). Source: IRC §3101(b)(2); Form 8959 (2024). */
export const ADDITIONAL_MEDICARE_2024 = {
  rate: 0.009,
  thresholds: {
    single: 200_000,
    hoh: 200_000,
    qss: 200_000,
    mfj: 250_000,
    mfs: 125_000,
  } as Record<FilingStatus, number>,
} as const

/** Net Investment Income Tax (Form 8960). Source: IRC §1411; Form 8960 (2024). */
export const NIIT_2024 = {
  rate: 0.038,
  thresholds: {
    single: 200_000,
    hoh: 200_000,
    qss: 250_000,
    mfj: 250_000,
    mfs: 125_000,
  } as Record<FilingStatus, number>,
} as const

/** Annual capital loss deduction limit (Schedule D). Source: IRC §1211(b). */
export const CAPITAL_LOSS_LIMIT_2024: Record<FilingStatus, number> = {
  single: 3_000,
  mfj: 3_000,
  qss: 3_000,
  hoh: 3_000,
  mfs: 1_500,
}

/** Medical expense AGI floor for itemized deductions. Source: IRC §213(a). */
export const MEDICAL_AGI_FLOOR_2024 = 0.075

/** SALT (state & local tax) deduction cap. Source: IRC §164(b)(6). */
export const SALT_CAP_2024 = {
  standard: 10_000,
  mfs: 5_000,
} as const

/** Charitable AGI limits. Source: IRC §170(b). */
export const CHARITABLE_LIMITS_2024 = {
  cashPctOfAgi: 0.6,
  nonCashPctOfAgi: 0.3,
} as const

/** Mortgage acquisition-debt limits for interest deductibility. Source: IRC §163(h)(3). */
export const MORTGAGE_DEBT_LIMIT_2024 = {
  /** Loans after 12/15/2017. */
  postDec2017: 750_000,
  postDec2017Mfs: 375_000,
  /** Grandfathered loans on/before 12/15/2017. */
  grandfathered: 1_000_000,
  grandfatheredMfs: 500_000,
} as const

/** Student loan interest deduction. Source: IRC §221; Rev. Proc. 2023-34 §2.21. */
export const STUDENT_LOAN_INTEREST_2024 = {
  maxDeduction: 2_500,
  phaseout: {
    single: { start: 80_000, end: 95_000 },
    hoh: { start: 80_000, end: 95_000 },
    qss: { start: 80_000, end: 95_000 },
    mfj: { start: 165_000, end: 195_000 },
    // MFS cannot claim the student loan interest deduction.
    mfs: { start: 0, end: 0 },
  } as Record<FilingStatus, { start: number; end: number }>,
} as const

/** Educator expense above-the-line deduction. Source: IRC §62(a)(2)(D); Rev. Proc. 2023-34. */
export const EDUCATOR_EXPENSE_2024 = {
  perEducator: 300,
} as const

/** Additional tax on early retirement distributions. Source: IRC §72(t); Form 5329. */
export const EARLY_WITHDRAWAL_PENALTY_2024 = {
  rate: 0.1,
  /** Box 7 codes that mean "early distribution, no known exception applies". */
  earlyNoExceptionCodes: ["1", "J", "S"],
} as const
