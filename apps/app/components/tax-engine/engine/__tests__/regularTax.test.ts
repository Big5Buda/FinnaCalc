import { describe, it, expect } from "vitest"
import {
  bracketTax,
  marginalRate,
  computeRegularTax,
} from "../pipeline/regularTax"

/**
 * Regular tax — verified against the 2024 Tax Rate Schedules and the Tax Table
 * midpoint method. All expected values are hand-computed from Rev. Proc. 2023-34
 * brackets.
 */
describe("bracketTax (exact 2024 rate schedule)", () => {
  it("is zero at or below zero", () => {
    expect(bracketTax(0, "single")).toBe(0)
    expect(bracketTax(-100, "single")).toBe(0)
  })

  it("single: top of the 10% bracket = $1,160", () => {
    expect(bracketTax(11_600, "single")).toBeCloseTo(1_160, 2)
  })

  it("single: top of the 12% bracket ($47,150) = $5,426", () => {
    expect(bracketTax(47_150, "single")).toBeCloseTo(5_426, 2)
  })

  it("single: $200,000 taxable = $41,686.50 (pre-rounding)", () => {
    expect(bracketTax(200_000, "single")).toBeCloseTo(41_686.5, 2)
  })

  it("mfj: $200,000 taxable = $34,106", () => {
    expect(bracketTax(200_000, "mfj")).toBeCloseTo(34_106, 2)
  })

  it("hoh: $100,000 taxable = $15,359", () => {
    expect(bracketTax(100_000, "hoh")).toBeCloseTo(15_359, 2)
  })

  it("qss uses the mfj schedule", () => {
    expect(bracketTax(200_000, "qss")).toBeCloseTo(bracketTax(200_000, "mfj"), 2)
  })
})

describe("marginalRate", () => {
  it("single $50k → 22%, $10k → 10%", () => {
    expect(marginalRate(50_000, "single")).toBe(0.22)
    expect(marginalRate(10_000, "single")).toBe(0.1)
  })
  it("mfj $200k → 22% (below the $201,050 step)", () => {
    expect(marginalRate(200_000, "mfj")).toBe(0.22)
  })
  it("zero income → 0% marginal", () => {
    expect(marginalRate(0, "single")).toBe(0)
  })
})

describe("computeRegularTax (Tax Table < $100k vs Computation Worksheet ≥ $100k)", () => {
  it("single $40,000 uses the Tax Table midpoint ($40,025) = $4,571", () => {
    const res = computeRegularTax(40_000, "single")
    expect(res.usedTaxTable).toBe(true)
    expect(res.tax).toBe(4_571)
  })

  it("single $100,000 uses the Computation Worksheet = $17,053", () => {
    const res = computeRegularTax(100_000, "single")
    expect(res.usedTaxTable).toBe(false)
    expect(res.tax).toBe(17_053)
  })

  it("single $200,000 = $41,687 (rounded from 41,686.50)", () => {
    expect(computeRegularTax(200_000, "single").tax).toBe(41_687)
  })

  it("the $100,000 boundary switches table → worksheet", () => {
    expect(computeRegularTax(99_999, "single").usedTaxTable).toBe(true)
    expect(computeRegularTax(100_000, "single").usedTaxTable).toBe(false)
  })

  it("zero taxable income → $0 tax", () => {
    expect(computeRegularTax(0, "single").tax).toBe(0)
  })
})
