import { describe, it, expect } from "vitest"
import { computeQualifiedDivCapGainTax } from "../pipeline/qualifiedDivCapGain"

/**
 * Qualified Dividends & Capital Gain Tax Worksheet — preferential income stacked
 * on top of ordinary income, taxed at 2024 0/15/20% breakpoints.
 */
describe("Qualified Dividends & Capital Gain Tax Worksheet (single)", () => {
  it("$40k ordinary + $10k qualified div spanning the 0% and 15% breakpoints", () => {
    // ordinary $40,000; preferential $10,000; single 0% breakpoint = $47,025.
    const res = computeQualifiedDivCapGainTax(50_000, 10_000, 0, "single")
    expect(res.amountAt0).toBe(7_025) // 47,025 − 40,000
    expect(res.amountAt15).toBe(2_975) // 50,000 − 47,025
    expect(res.amountAt20).toBe(0)
    // ordinary tax (Tax Table on $40,000 = $4,571) + 15% × 2,975 = 446.25 → $5,017
    expect(res.tax).toBe(5_017)
  })

  it("all preferential income falls in the 0% bracket", () => {
    // ordinary $30,000; preferential $10,000; entirely below $47,025.
    const res = computeQualifiedDivCapGainTax(40_000, 10_000, 0, "single")
    expect(res.amountAt0).toBe(10_000)
    expect(res.amountAt15).toBe(0)
    // tax = ordinary tax on $30,000 (Tax Table $3,371), preferential taxed at 0%
    expect(res.tax).toBe(3_371)
  })

  it("high income reaches the 20% rate", () => {
    // ordinary $500,000; preferential $100,000 LTCG; single 15% breakpoint = $518,900.
    const res = computeQualifiedDivCapGainTax(600_000, 0, 100_000, "single")
    expect(res.amountAt0).toBe(0)
    expect(res.amountAt15).toBe(18_900) // 518,900 − 500,000
    expect(res.amountAt20).toBe(81_100) // 600,000 − 518,900
    // ordinary tax on $500,000 ($145,375) + 15%×18,900 + 20%×81,100 = $164,430
    expect(res.tax).toBe(164_430)
  })

  it("never costs more than taxing everything at ordinary rates", () => {
    const ti = 60_000
    const pref = computeQualifiedDivCapGainTax(ti, 5_000, 0, "single").tax
    // Compare against all-ordinary by passing zero preferential income.
    const ordinary = computeQualifiedDivCapGainTax(ti, 0, 0, "single").tax
    expect(pref).toBeLessThanOrEqual(ordinary)
  })
})
