/**
 * 2024 constants for the credit suite: Child & Dependent Care (2441), education
 * (8863), Saver's (8880), Residential Clean Energy (5695), Clean Vehicle (8936).
 * Sources: IRC §21/§25A/§25B/§25D/§30D; Rev. Proc. 2023-34 (education/saver's).
 */
import type { FilingStatus } from "../../types/filing"

/** Child & Dependent Care Credit (Form 2441) — not inflation-indexed. */
export const CARE_CREDIT_2024 = {
  expenseCapOnePerson: 3_000,
  expenseCapTwoPlus: 6_000,
  maxRate: 0.35,
  minRate: 0.2,
  /** AGI at/below which the 35% rate applies. */
  fullRateAgiCeiling: 15_000,
  /** Rate drops 1% per $2,000 of AGI over the ceiling, to a 20% floor. */
  rateStepIncome: 2_000,
  rateStep: 0.01,
} as const

/** Education credits (Form 8863). */
export const EDUCATION_CREDITS_2024 = {
  aotc: {
    /** 100% of the first $2,000 + 25% of the next $2,000 = $2,500 max. */
    firstTier: 2_000,
    secondTier: 2_000,
    secondTierRate: 0.25,
    max: 2_500,
    refundablePortion: 0.4,
    maxPriorYears: 4,
  },
  llc: {
    /** 20% of up to $10,000 of expenses (aggregate), max $2,000. */
    rate: 0.2,
    expenseCap: 10_000,
    max: 2_000,
  },
  /** MAGI phaseout (same range for AOTC and LLC in 2024). */
  phaseout: {
    single: { start: 80_000, end: 90_000 },
    hoh: { start: 80_000, end: 90_000 },
    qss: { start: 80_000, end: 90_000 },
    mfj: { start: 160_000, end: 180_000 },
    mfs: { start: 0, end: 0 }, // MFS cannot claim education credits
  } as Record<FilingStatus, { start: number; end: number }>,
} as const

/** Retirement Savings Contributions Credit (Saver's Credit, Form 8880). */
export const SAVERS_CREDIT_2024 = {
  contributionCap: 2_000, // per person; $4,000 combined for MFJ
  /** AGI ceilings for the 50% / 20% / 10% rate tiers (above the last → 0%). */
  tiers: {
    single: [
      { rate: 0.5, agiCeiling: 23_000 },
      { rate: 0.2, agiCeiling: 25_000 },
      { rate: 0.1, agiCeiling: 38_250 },
    ],
    mfs: [
      { rate: 0.5, agiCeiling: 23_000 },
      { rate: 0.2, agiCeiling: 25_000 },
      { rate: 0.1, agiCeiling: 38_250 },
    ],
    qss: [
      { rate: 0.5, agiCeiling: 23_000 },
      { rate: 0.2, agiCeiling: 25_000 },
      { rate: 0.1, agiCeiling: 38_250 },
    ],
    hoh: [
      { rate: 0.5, agiCeiling: 34_500 },
      { rate: 0.2, agiCeiling: 37_500 },
      { rate: 0.1, agiCeiling: 57_375 },
    ],
    mfj: [
      { rate: 0.5, agiCeiling: 46_000 },
      { rate: 0.2, agiCeiling: 50_000 },
      { rate: 0.1, agiCeiling: 76_500 },
    ],
  } as Record<FilingStatus, Array<{ rate: number; agiCeiling: number }>>,
} as const

/** Residential Clean Energy Credit (Form 5695) — 30% of qualified property cost. */
export const CLEAN_ENERGY_2024 = { rate: 0.3 } as const

/** New Clean Vehicle Credit (Form 8936). */
export const EV_CREDIT_2024 = {
  max: 7_500,
  magiCap: {
    single: 150_000,
    hoh: 225_000,
    mfs: 150_000,
    qss: 150_000,
    mfj: 300_000,
  } as Record<FilingStatus, number>,
} as const
