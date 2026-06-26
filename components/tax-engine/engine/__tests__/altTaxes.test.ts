import { describe, it, expect } from "vitest"
import { computeAmt } from "../pipeline/amt"
import { computeNiit } from "../pipeline/niit"
import { computeAdditionalMedicareTax } from "../pipeline/additionalMedicare"

/** AMT (6251), NIIT (8960), Additional Medicare Tax (8959). */
describe("AMT (Form 6251)", () => {
  it("normal case → no AMT (regular tax exceeds the tentative minimum)", () => {
    const res = computeAmt({
      taxableIncome: 50_000,
      addBacks: 14_600,
      preferentialIncome: 0,
      regularTax: 6_059,
      status: "single",
    })
    expect(res.amt).toBe(0)
  })

  it("26%/28% breakpoint applied to the AMT base", () => {
    // AMTI 350,000 − 85,700 exemption = 264,300 base.
    // 232,600×26% + (264,300−232,600)×28% = 60,476 + 8,876 = 69,352
    const res = computeAmt({
      taxableIncome: 300_000,
      addBacks: 50_000,
      preferentialIncome: 0,
      regularTax: 1_000,
      status: "single",
    })
    expect(res.tentativeMinimumTax).toBe(69_352)
    expect(res.amt).toBe(68_352)
  })

  it("exemption phases out 25¢ per $1 over the threshold", () => {
    // AMTI 700,000 > 609,350 → exemption 85,700 − 25%×90,650 = 63,037.50
    const res = computeAmt({
      taxableIncome: 700_000,
      addBacks: 0,
      preferentialIncome: 0,
      regularTax: 0,
      status: "single",
    })
    expect(res.exemption).toBeCloseTo(63_037.5, 2)
    expect(res.tentativeMinimumTax).toBe(173_698)
  })
})

describe("NIIT (Form 8960)", () => {
  it("3.8% of NII when MAGI is well over the threshold", () => {
    expect(computeNiit(50_000, 250_000, "single")).toBeCloseTo(1_900, 2)
  })
  it("limited to MAGI over the threshold", () => {
    expect(computeNiit(50_000, 210_000, "single")).toBeCloseTo(380, 2) // 3.8% × 10,000
  })
  it("no NIIT below the threshold", () => {
    expect(computeNiit(50_000, 150_000, "single")).toBe(0)
  })
})

describe("Additional Medicare Tax (Form 8959)", () => {
  it("0.9% on wages over $200,000 (single)", () => {
    expect(computeAdditionalMedicareTax(250_000, 0, "single")).toBeCloseTo(450, 2)
  })
  it("MFJ threshold is $250,000", () => {
    expect(computeAdditionalMedicareTax(300_000, 0, "mfj")).toBeCloseTo(450, 2)
  })
  it("threshold applied to wages first, then to SE earnings", () => {
    // wages 150k (under 200k); remaining threshold 50k; SE 100k → (100k−50k)×0.9%
    expect(computeAdditionalMedicareTax(150_000, 100_000, "single")).toBeCloseTo(450, 2)
  })
  it("no tax below the threshold", () => {
    expect(computeAdditionalMedicareTax(100_000, 0, "single")).toBe(0)
  })
})
