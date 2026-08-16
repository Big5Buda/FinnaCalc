import { describe, it, expect } from "vitest"
import { computeSelfEmploymentTax } from "../pipeline/scheduleSE"

/**
 * Schedule SE — 92.35% net-earnings factor, 12.4% SS up to the $168,600 wage base
 * (reduced by W-2 SS wages), 2.9% uncapped Medicare, 50% deductible.
 */
describe("self-employment tax (Schedule SE)", () => {
  it("$50,000 net SE, no W-2 → SE tax $7,064.78, deduction $3,532.39", () => {
    const res = computeSelfEmploymentTax(
      { taxpayer: 50_000, spouse: 0 },
      { taxpayer: 0, spouse: 0 },
    )
    // 50,000 × 0.9235 = 46,175 net earnings; × 0.153 = 7,064.775
    expect(res.netEarnings).toBeCloseTo(46_175, 2)
    expect(res.seTax).toBeCloseTo(7_064.775, 2)
    expect(res.deduction).toBeCloseTo(3_532.3875, 2)
  })

  it("W-2 SS wages at the wage base → only the 2.9% Medicare portion applies", () => {
    const res = computeSelfEmploymentTax(
      { taxpayer: 50_000, spouse: 0 },
      { taxpayer: 168_600, spouse: 0 },
    )
    // SS portion fully absorbed by W-2 wages; 46,175 × 0.029 = 1,339.075
    expect(res.seTax).toBeCloseTo(1_339.075, 2)
  })

  it("net earnings under $400 → no SE tax", () => {
    const res = computeSelfEmploymentTax({ taxpayer: 400, spouse: 0 }, { taxpayer: 0, spouse: 0 })
    expect(res.seTax).toBe(0)
  })

  it("computes SE tax per owner and sums", () => {
    const res = computeSelfEmploymentTax(
      { taxpayer: 50_000, spouse: 30_000 },
      { taxpayer: 0, spouse: 0 },
    )
    // 46,175×0.153 + 27,705×0.153 = 7,064.775 + 4,238.865
    expect(res.seTax).toBeCloseTo(11_303.64, 2)
  })
})
