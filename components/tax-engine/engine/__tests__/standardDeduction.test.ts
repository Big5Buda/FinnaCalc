import { describe, it, expect } from "vitest"
import { computeStandardDeduction, isConsidered65For2024 } from "../pipeline/deductionCompare"
import { baseReturn } from "../fixtures/builders"

/**
 * Standard deduction matrix — 2024 base amounts, age-65/blind additions, and the
 * dependent cap. Verified against the 2024 Form 1040 Standard Deduction Chart.
 */
describe("isConsidered65For2024 (born before Jan 2, 1960)", () => {
  it("born 1955 → treated as 65+", () => {
    expect(isConsidered65For2024("1955-06-15")).toBe(true)
  })
  it("born 1960-01-01 → treated as 65+ (inclusive)", () => {
    expect(isConsidered65For2024("1960-01-01")).toBe(true)
  })
  it("born 1960-01-02 → not 65+", () => {
    expect(isConsidered65For2024("1960-01-02")).toBe(false)
  })
  it("born 1990 → not 65+", () => {
    expect(isConsidered65For2024("1990-01-01")).toBe(false)
  })
})

describe("standard deduction base amounts (2024)", () => {
  it("single = $14,600", () => {
    expect(computeStandardDeduction(baseReturn("single"), 0)).toBe(14_600)
  })
  it("mfj = $29,200", () => {
    expect(computeStandardDeduction(baseReturn("mfj"), 0)).toBe(29_200)
  })
  it("hoh = $21,900", () => {
    expect(computeStandardDeduction(baseReturn("hoh"), 0)).toBe(21_900)
  })
  it("mfs = $14,600", () => {
    expect(computeStandardDeduction(baseReturn("mfs"), 0)).toBe(14_600)
  })
  it("qss = $29,200", () => {
    expect(computeStandardDeduction(baseReturn("qss"), 0)).toBe(29_200)
  })
})

describe("additional standard deduction (age 65+ / blind)", () => {
  it("single, blind → 14,600 + 1,950 = 16,550", () => {
    const r = baseReturn("single")
    r.taxpayer.blind = true
    expect(computeStandardDeduction(r, 0)).toBe(16_550)
  })
  it("single, 65+ and blind → 14,600 + 2×1,950 = 18,500", () => {
    const r = baseReturn("single")
    r.taxpayer.dateOfBirth = "1950-01-01"
    r.taxpayer.blind = true
    expect(computeStandardDeduction(r, 0)).toBe(18_500)
  })
  it("mfj, both 65+ → 29,200 + 2×1,550 = 32,300", () => {
    const r = baseReturn("mfj")
    r.taxpayer.dateOfBirth = "1950-01-01"
    r.spouse = { ...r.taxpayer }
    expect(computeStandardDeduction(r, 0)).toBe(32_300)
  })
  it("mfj, taxpayer 65+, spouse 65+ and blind → 29,200 + 3×1,550 = 33,850", () => {
    const r = baseReturn("mfj")
    r.taxpayer.dateOfBirth = "1950-01-01"
    r.spouse = { ...r.taxpayer, blind: true }
    expect(computeStandardDeduction(r, 0)).toBe(33_850)
  })
})

describe("dependent standard deduction cap", () => {
  it("dependent with $5,000 earned income → max(1,300, 5,450) = 5,450", () => {
    const r = baseReturn("single")
    r.taxpayer.claimedAsDependentByAnother = true
    expect(computeStandardDeduction(r, 5_000)).toBe(5_450)
  })
  it("dependent with $200 earned income → floor of $1,300", () => {
    const r = baseReturn("single")
    r.taxpayer.claimedAsDependentByAnother = true
    expect(computeStandardDeduction(r, 200)).toBe(1_300)
  })
  it("dependent with $20,000 earned income → capped at the $14,600 base", () => {
    const r = baseReturn("single")
    r.taxpayer.claimedAsDependentByAnother = true
    expect(computeStandardDeduction(r, 20_000)).toBe(14_600)
  })
  it("dependent ($5,000 earned) who is blind → 5,450 + 1,950 = 7,400", () => {
    const r = baseReturn("single")
    r.taxpayer.claimedAsDependentByAnother = true
    r.taxpayer.blind = true
    expect(computeStandardDeduction(r, 5_000)).toBe(7_400)
  })
})
