import { describe, it, expect } from "vitest"
import { computeStateTax } from "../stateTaxData"
import { calculateFederalTax } from "../calculator"
import { baseReturn, withW2 } from "../fixtures/builders"
import type { StateInput } from "../stateTaxData/types"
import type { StateCode } from "../../types/filing"

const input = (over: Partial<StateInput> & { code: StateCode | "" }): StateInput => ({
  federalAgi: 0,
  taxableSocialSecurity: 0,
  retirementDistributions: 0,
  filingStatus: "single",
  dependents: 0,
  stateWithholding: 0,
  age65: false,
  ...over,
})

describe("no-income-tax states", () => {
  it("Texas has no income tax", () => {
    const res = computeStateTax(input({ code: "TX", federalAgi: 100_000 }))!
    expect(res.hasIncomeTax).toBe(false)
    expect(res.tax).toBe(0)
  })
  it("Washington notes its separate capital-gains excise", () => {
    const res = computeStateTax(input({ code: "WA", federalAgi: 100_000 }))!
    expect(res.hasIncomeTax).toBe(false)
    expect(res.note).toMatch(/capital-gains|excise/i)
  })
})

describe("flat-tax states", () => {
  it("Illinois: 4.95% after the $2,775 exemption", () => {
    // (60,000 − 2,775) × 4.95% = 2,832.64 → $2,833
    const res = computeStateTax(input({ code: "IL", federalAgi: 60_000 }))!
    expect(res.tax).toBe(2_833)
  })
  it("North Carolina: 4.5% after the $12,750 standard deduction", () => {
    // (50,000 − 12,750) × 4.5% = 1,676.25 → $1,676
    expect(computeStateTax(input({ code: "NC", federalAgi: 50_000 }))!.tax).toBe(1_676)
  })
  it("Pennsylvania excludes retirement income (3.07% flat)", () => {
    // (60,000 − 20,000 retirement) × 3.07% = 1,228
    const res = computeStateTax(input({ code: "PA", federalAgi: 60_000, retirementDistributions: 20_000 }))!
    expect(res.tax).toBe(1_228)
  })
})

describe("progressive states", () => {
  it("California: single $100,000 AGI → $5,289 after the exemption credit", () => {
    expect(computeStateTax(input({ code: "CA", federalAgi: 100_000 }))!.tax).toBe(5_289)
  })
  it("New York: single $80,000 AGI → $3,795", () => {
    expect(computeStateTax(input({ code: "NY", federalAgi: 80_000 }))!.tax).toBe(3_795)
  })
})

describe("common rules", () => {
  it("subtracts taxable Social Security from state AGI", () => {
    // NC: (50,000 − 10,000 SS − 12,750) × 4.5% = 1,226.25 → $1,226
    const res = computeStateTax(input({ code: "NC", federalAgi: 50_000, taxableSocialSecurity: 10_000 }))!
    expect(res.tax).toBe(1_226)
  })
  it("computes state refund vs balance due from withholding", () => {
    const res = computeStateTax(input({ code: "NC", federalAgi: 50_000, stateWithholding: 2_000 }))!
    expect(res.refundOrOwed).toBe(324) // 2,000 − 1,676
  })
  it("marks unsupported states rather than guessing", () => {
    const res = computeStateTax(input({ code: "CO" as StateCode, federalAgi: 50_000 }))!
    expect(res.supported).toBe(false)
    expect(res.tax).toBe(0)
  })
  it("returns undefined when no state is set", () => {
    expect(computeStateTax(input({ code: "" }))).toBeUndefined()
  })
})

describe("state tax integrated through the federal engine", () => {
  it("attaches a California result to a CA resident's return", () => {
    const r = withW2(baseReturn("single"), 100_000, 0)
    r.residency.state = "CA"
    const res = calculateFederalTax(r)
    expect(res.state?.code).toBe("CA")
    expect(res.state?.hasIncomeTax).toBe(true)
    // AGI here is 100,000 (no adjustments) → same as the standalone CA test.
    expect(res.state?.tax).toBe(5_289)
  })
})
