import { describe, it, expect } from "vitest"
import {
  hsaDeduction,
  iraDeduction,
  studentLoanInterestDeduction,
} from "../pipeline/adjustments"
import { baseReturn } from "../fixtures/builders"

/** Traditional IRA deduction phaseouts (IRC §219(g), 2024 ranges). */
describe("IRA deduction", () => {
  it("not covered by a plan → fully deductible", () => {
    expect(iraDeduction(7_000, 200_000, "single", false, false, false)).toBe(7_000)
  })
  it("covered, single, below phaseout → full $7,000", () => {
    expect(iraDeduction(7_000, 50_000, "single", true, false, false)).toBe(7_000)
  })
  it("covered, single, midpoint of $77k–$87k → $3,500", () => {
    expect(iraDeduction(7_000, 82_000, "single", true, false, false)).toBe(3_500)
  })
  it("covered, single, above $87k → $0", () => {
    expect(iraDeduction(7_000, 90_000, "single", true, false, false)).toBe(0)
  })
  it("covered, single, tiny remaining deduction floors at $200", () => {
    // MAGI 86,900 → ratio 0.01 → $70 → floored up to the $200 minimum
    expect(iraDeduction(7_000, 86_900, "single", true, false, false)).toBe(200)
  })
  it("age 50+ catch-up raises the limit to $8,000", () => {
    expect(iraDeduction(8_000, 50_000, "single", true, false, true)).toBe(8_000)
  })
  it("MFJ, not covered but spouse is, midpoint of $230k–$240k → $3,500", () => {
    expect(iraDeduction(7_000, 235_000, "mfj", false, true, false)).toBe(3_500)
  })
  it("MFS covered, midpoint of $0–$10k → $3,500", () => {
    expect(iraDeduction(7_000, 5_000, "mfs", true, false, false)).toBe(3_500)
  })
})

/** HSA deduction (Form 8889) — capped by coverage limit + 55+ catch-up. */
describe("HSA deduction", () => {
  it("self-only coverage caps at $4,150", () => {
    const r = baseReturn("single")
    r.adjustments.hsaCoverage = "self-only"
    r.adjustments.hsaContribution = 5_000
    expect(hsaDeduction(r)).toBe(4_150)
  })
  it("family coverage caps at $8,300", () => {
    const r = baseReturn("single")
    r.adjustments.hsaCoverage = "family"
    r.adjustments.hsaContribution = 9_000
    expect(hsaDeduction(r)).toBe(8_300)
  })
  it("age 55+ adds the $1,000 catch-up", () => {
    const r = baseReturn("single")
    r.taxpayer.dateOfBirth = "1965-01-01"
    r.adjustments.hsaCoverage = "self-only"
    r.adjustments.hsaContribution = 5_000
    expect(hsaDeduction(r)).toBe(5_000) // limit 5,150, contribution 5,000
  })
  it("no HDHP coverage → $0", () => {
    expect(hsaDeduction(baseReturn("single"))).toBe(0)
  })
})

/** Student loan interest deduction phaseout (2024). */
describe("student loan interest deduction", () => {
  it("below phaseout → up to $2,500", () => {
    expect(studentLoanInterestDeduction(2_000, 50_000, "single")).toBe(2_000)
    expect(studentLoanInterestDeduction(3_000, 50_000, "single")).toBe(2_500)
  })
  it("MFS may never claim it", () => {
    expect(studentLoanInterestDeduction(2_000, 10_000, "mfs")).toBe(0)
  })
  it("single midpoint of $80k–$95k phaseout → half", () => {
    expect(studentLoanInterestDeduction(2_500, 87_500, "single")).toBeCloseTo(1_250, 2)
  })
})
