import { describe, it, expect } from "vitest"
import { computeQbiDeduction } from "../pipeline/qbi"

/** QBI deduction (§199A) — below threshold, overall limit, and SSTB phaseout. */
describe("QBI deduction", () => {
  it("below threshold → 20% of QBI", () => {
    const res = computeQbiDeduction({
      qbiIncome: 50_000,
      taxableIncomeBeforeQbi: 100_000,
      netCapitalGain: 0,
      isSSTB: false,
      status: "single",
    })
    expect(res.deduction).toBe(10_000)
    expect(res.wageLimitMayApply).toBe(false)
  })

  it("capped at 20% of (taxable income − net capital gain)", () => {
    const res = computeQbiDeduction({
      qbiIncome: 50_000,
      taxableIncomeBeforeQbi: 40_000,
      netCapitalGain: 0,
      isSSTB: false,
      status: "single",
    })
    expect(res.deduction).toBe(8_000) // 20% × 40,000
  })

  it("net capital gain reduces the overall limit", () => {
    const res = computeQbiDeduction({
      qbiIncome: 50_000,
      taxableIncomeBeforeQbi: 100_000,
      netCapitalGain: 30_000,
      isSSTB: false,
      status: "single",
    })
    expect(res.deduction).toBe(10_000) // min(10,000, 20%×70,000=14,000)
  })

  it("SSTB fully phased out above threshold + range", () => {
    const res = computeQbiDeduction({
      qbiIncome: 50_000,
      taxableIncomeBeforeQbi: 250_000, // > 191,950 + 50,000
      netCapitalGain: 0,
      isSSTB: true,
      status: "single",
    })
    expect(res.deduction).toBe(0)
  })

  it("SSTB partial phaseout at the midpoint of the range", () => {
    const res = computeQbiDeduction({
      qbiIncome: 50_000,
      taxableIncomeBeforeQbi: 216_950, // threshold + 25,000 (half of 50,000)
      netCapitalGain: 0,
      isSSTB: true,
      status: "single",
    })
    expect(res.deduction).toBe(5_000) // 20% × 50,000 × 50%
  })

  it("non-SSTB above threshold flags the untracked W-2/UBIA limit", () => {
    const res = computeQbiDeduction({
      qbiIncome: 50_000,
      taxableIncomeBeforeQbi: 250_000,
      netCapitalGain: 0,
      isSSTB: false,
      status: "single",
    })
    expect(res.wageLimitMayApply).toBe(true)
  })
})
