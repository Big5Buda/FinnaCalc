/**
 * 2024 state income tax data for the 15 most populous states.
 * Sources: each state's 2024 income tax instructions / rate schedules and DOR
 * inflation announcements. No-income-tax states return zero.
 */
import type { FilingStatus } from "../../types/filing"
import type { StateBracket, StateConfig } from "./types"

const FLAT = (rate: number): StateBracket[] => [{ rate, min: 0, max: Infinity }]

/** Same brackets for every filing status. */
function uniform(b: StateBracket[]): Record<FilingStatus, StateBracket[]> {
  return { single: b, mfj: b, mfs: b, hoh: b, qss: b }
}

/** Map single/mfj/hoh → all statuses (mfs uses single; qss uses mfj). */
function byStatus(opts: {
  single: StateBracket[]
  mfj: StateBracket[]
  hoh: StateBracket[]
}): Record<FilingStatus, StateBracket[]> {
  return { single: opts.single, mfs: opts.single, mfj: opts.mfj, qss: opts.mfj, hoh: opts.hoh }
}

/** Standard deduction record from the common (single, mfj, hoh) values. */
function std(
  single: number,
  mfj: number,
  hoh: number,
  mfs = single,
  qss = mfj,
): Record<FilingStatus, number> {
  return { single, mfj, hoh, mfs, qss }
}

const NO_TAX_NOTE = "No state income tax."

export const STATE_CONFIGS: Record<string, StateConfig> = {
  // ---- No income tax ----
  TX: { code: "TX", name: "Texas", hasIncomeTax: false, note: NO_TAX_NOTE },
  FL: { code: "FL", name: "Florida", hasIncomeTax: false, note: NO_TAX_NOTE },
  TN: { code: "TN", name: "Tennessee", hasIncomeTax: false, note: NO_TAX_NOTE },
  WA: {
    code: "WA",
    name: "Washington",
    hasIncomeTax: false,
    note: "No state income tax on wages. (Washington has a separate 7% excise on large long-term capital gains, not modeled here.)",
  },

  // ---- Flat rate ----
  PA: {
    code: "PA",
    name: "Pennsylvania",
    hasIncomeTax: true,
    brackets: uniform(FLAT(0.0307)),
    taxesSocialSecurity: false,
    excludesRetirement: true,
    note: "Flat 3.07%. Retirement income and Social Security aren't taxed; PA's class-of-income rules are approximated from federal AGI.",
  },
  IL: {
    code: "IL",
    name: "Illinois",
    hasIncomeTax: true,
    brackets: uniform(FLAT(0.0495)),
    personalExemption: 2_775,
    dependentExemption: 2_775,
    excludesRetirement: true,
    note: "Flat 4.95%; retirement income and Social Security excluded.",
  },
  MI: {
    code: "MI",
    name: "Michigan",
    hasIncomeTax: true,
    brackets: uniform(FLAT(0.0425)),
    personalExemption: 5_600,
    dependentExemption: 5_600,
    note: "Flat 4.25%. Social Security excluded; age-based retirement subtractions are not modeled.",
  },
  NC: {
    code: "NC",
    name: "North Carolina",
    hasIncomeTax: true,
    brackets: uniform(FLAT(0.045)),
    standardDeduction: std(12_750, 25_500, 19_125),
    note: "Flat 4.5%. Social Security excluded.",
  },
  AZ: {
    code: "AZ",
    name: "Arizona",
    hasIncomeTax: true,
    brackets: uniform(FLAT(0.025)),
    standardDeduction: std(14_600, 29_200, 21_900),
    note: "Flat 2.5% (standard deduction matches federal). Social Security excluded.",
  },
  GA: {
    code: "GA",
    name: "Georgia",
    hasIncomeTax: true,
    brackets: uniform(FLAT(0.0539)),
    standardDeduction: std(12_000, 24_000, 12_000),
    dependentExemption: 4_000,
    note: "Flat 5.39% (2024). Social Security excluded; the 62+ retirement exclusion isn't modeled.",
  },
  OH: {
    code: "OH",
    name: "Ohio",
    hasIncomeTax: true,
    brackets: uniform([
      { rate: 0, min: 0, max: 26_050 },
      { rate: 0.0275, min: 26_050, max: 100_000 },
      { rate: 0.035, min: 100_000, max: Infinity },
    ]),
    personalExemption: 2_400,
    dependentExemption: 2_400,
    note: "2024 brackets (0% up to $26,050, then 2.75%/3.5%). Social Security excluded.",
  },

  // ---- Progressive ----
  VA: {
    code: "VA",
    name: "Virginia",
    hasIncomeTax: true,
    brackets: uniform([
      { rate: 0.02, min: 0, max: 3_000 },
      { rate: 0.03, min: 3_000, max: 5_000 },
      { rate: 0.05, min: 5_000, max: 17_000 },
      { rate: 0.0575, min: 17_000, max: Infinity },
    ]),
    standardDeduction: std(8_500, 17_000, 8_500),
    personalExemption: 930,
    dependentExemption: 930,
    note: "Social Security excluded; the age deduction isn't modeled.",
  },
  CA: {
    code: "CA",
    name: "California",
    hasIncomeTax: true,
    brackets: byStatus({
      single: [
        { rate: 0.01, min: 0, max: 10_412 },
        { rate: 0.02, min: 10_412, max: 24_684 },
        { rate: 0.04, min: 24_684, max: 38_959 },
        { rate: 0.06, min: 38_959, max: 54_081 },
        { rate: 0.08, min: 54_081, max: 68_350 },
        { rate: 0.093, min: 68_350, max: 349_137 },
        { rate: 0.103, min: 349_137, max: 418_961 },
        { rate: 0.113, min: 418_961, max: 698_271 },
        { rate: 0.123, min: 698_271, max: Infinity },
      ],
      mfj: [
        { rate: 0.01, min: 0, max: 20_824 },
        { rate: 0.02, min: 20_824, max: 49_368 },
        { rate: 0.04, min: 49_368, max: 77_918 },
        { rate: 0.06, min: 77_918, max: 108_162 },
        { rate: 0.08, min: 108_162, max: 136_700 },
        { rate: 0.093, min: 136_700, max: 698_274 },
        { rate: 0.103, min: 698_274, max: 837_922 },
        { rate: 0.113, min: 837_922, max: 1_396_542 },
        { rate: 0.123, min: 1_396_542, max: Infinity },
      ],
      hoh: [
        { rate: 0.01, min: 0, max: 20_839 },
        { rate: 0.02, min: 20_839, max: 49_371 },
        { rate: 0.04, min: 49_371, max: 63_644 },
        { rate: 0.06, min: 63_644, max: 78_765 },
        { rate: 0.08, min: 78_765, max: 93_037 },
        { rate: 0.093, min: 93_037, max: 474_824 },
        { rate: 0.103, min: 474_824, max: 569_790 },
        { rate: 0.113, min: 569_790, max: 949_649 },
        { rate: 0.123, min: 949_649, max: Infinity },
      ],
    }),
    standardDeduction: std(5_540, 11_080, 11_080),
    exemptionCredit: 149,
    dependentExemptionCredit: 461,
    note: "Social Security excluded. The 1% mental-health surcharge over $1M isn't modeled.",
  },
  NY: {
    code: "NY",
    name: "New York",
    hasIncomeTax: true,
    brackets: byStatus({
      single: [
        { rate: 0.04, min: 0, max: 8_500 },
        { rate: 0.045, min: 8_500, max: 11_700 },
        { rate: 0.0525, min: 11_700, max: 13_900 },
        { rate: 0.055, min: 13_900, max: 80_650 },
        { rate: 0.06, min: 80_650, max: 215_400 },
        { rate: 0.0685, min: 215_400, max: 1_077_550 },
        { rate: 0.0965, min: 1_077_550, max: 5_000_000 },
        { rate: 0.103, min: 5_000_000, max: 25_000_000 },
        { rate: 0.109, min: 25_000_000, max: Infinity },
      ],
      mfj: [
        { rate: 0.04, min: 0, max: 17_150 },
        { rate: 0.045, min: 17_150, max: 23_600 },
        { rate: 0.0525, min: 23_600, max: 27_900 },
        { rate: 0.055, min: 27_900, max: 161_550 },
        { rate: 0.06, min: 161_550, max: 323_200 },
        { rate: 0.0685, min: 323_200, max: 2_155_350 },
        { rate: 0.0965, min: 2_155_350, max: 5_000_000 },
        { rate: 0.103, min: 5_000_000, max: 25_000_000 },
        { rate: 0.109, min: 25_000_000, max: Infinity },
      ],
      hoh: [
        { rate: 0.04, min: 0, max: 12_800 },
        { rate: 0.045, min: 12_800, max: 17_650 },
        { rate: 0.0525, min: 17_650, max: 20_900 },
        { rate: 0.055, min: 20_900, max: 107_650 },
        { rate: 0.06, min: 107_650, max: 269_300 },
        { rate: 0.0685, min: 269_300, max: 1_616_450 },
        { rate: 0.0965, min: 1_616_450, max: 5_000_000 },
        { rate: 0.103, min: 5_000_000, max: 25_000_000 },
        { rate: 0.109, min: 25_000_000, max: Infinity },
      ],
    }),
    standardDeduction: std(8_000, 16_050, 11_200),
    dependentExemption: 1_000,
    note: "Social Security excluded; pension exclusion and tax-benefit recapture aren't modeled.",
  },
  NJ: {
    code: "NJ",
    name: "New Jersey",
    hasIncomeTax: true,
    brackets: byStatus({
      single: [
        { rate: 0.014, min: 0, max: 20_000 },
        { rate: 0.0175, min: 20_000, max: 35_000 },
        { rate: 0.035, min: 35_000, max: 40_000 },
        { rate: 0.05525, min: 40_000, max: 75_000 },
        { rate: 0.0637, min: 75_000, max: 500_000 },
        { rate: 0.0897, min: 500_000, max: 1_000_000 },
        { rate: 0.1075, min: 1_000_000, max: Infinity },
      ],
      mfj: [
        { rate: 0.014, min: 0, max: 20_000 },
        { rate: 0.0175, min: 20_000, max: 50_000 },
        { rate: 0.0245, min: 50_000, max: 70_000 },
        { rate: 0.035, min: 70_000, max: 80_000 },
        { rate: 0.05525, min: 80_000, max: 150_000 },
        { rate: 0.0637, min: 150_000, max: 500_000 },
        { rate: 0.0897, min: 500_000, max: 1_000_000 },
        { rate: 0.1075, min: 1_000_000, max: Infinity },
      ],
      hoh: [
        { rate: 0.014, min: 0, max: 20_000 },
        { rate: 0.0175, min: 20_000, max: 50_000 },
        { rate: 0.0245, min: 50_000, max: 70_000 },
        { rate: 0.035, min: 70_000, max: 80_000 },
        { rate: 0.05525, min: 80_000, max: 150_000 },
        { rate: 0.0637, min: 150_000, max: 500_000 },
        { rate: 0.0897, min: 500_000, max: 1_000_000 },
        { rate: 0.1075, min: 1_000_000, max: Infinity },
      ],
    }),
    personalExemption: 1_000,
    dependentExemption: 1_500,
    note: "No standard deduction. Social Security excluded; the retirement-income exclusion isn't modeled.",
  },
}
