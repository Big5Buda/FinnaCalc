import { describe, it, expect } from "vitest"
import { computeCapitalGains } from "../pipeline/capitalGains"
import { baseReturn, withCapitalTransaction } from "../fixtures/builders"

/** Schedule D netting, the $3,000 ($1,500 MFS) loss limit, and carryover character. */
describe("capital gains (Schedule D)", () => {
  it("net long-term gain → included in income and fully preferential", () => {
    const r = withCapitalTransaction(baseReturn("single"), 20_000, 12_000, true)
    const res = computeCapitalGains(r)
    expect(res.netLongTerm).toBe(8_000)
    expect(res.includedInIncome).toBe(8_000)
    expect(res.preferentialLTCG).toBe(8_000)
  })

  it("ST gain offset by LT loss → net is ordinary, no preferential", () => {
    let r = withCapitalTransaction(baseReturn("single"), 10_000, 5_000, false) // +5,000 ST
    r = withCapitalTransaction(r, 5_000, 8_000, true) // −3,000 LT
    const res = computeCapitalGains(r)
    expect(res.totalNet).toBe(2_000)
    expect(res.includedInIncome).toBe(2_000)
    expect(res.preferentialLTCG).toBe(0)
  })

  it("large LT loss → deduction capped at $3,000, $17,000 carries to long-term", () => {
    const r = withCapitalTransaction(baseReturn("single"), 0, 20_000, true)
    const res = computeCapitalGains(r)
    expect(res.includedInIncome).toBe(-3_000)
    expect(res.carryoverLong).toBe(17_000)
    expect(res.carryoverShort).toBe(0)
  })

  it("MFS loss limit is $1,500", () => {
    const r = withCapitalTransaction(baseReturn("mfs"), 0, 5_000, false) // −5,000 ST
    const res = computeCapitalGains(r)
    expect(res.includedInIncome).toBe(-1_500)
    expect(res.carryoverShort).toBe(3_500)
  })

  it("both ST and LT losses → allowed loss applied to short-term first", () => {
    let r = withCapitalTransaction(baseReturn("single"), 0, 2_000, false) // −2,000 ST
    r = withCapitalTransaction(r, 0, 5_000, true) // −5,000 LT
    const res = computeCapitalGains(r)
    expect(res.includedInIncome).toBe(-3_000)
    expect(res.carryoverShort).toBe(0)
    expect(res.carryoverLong).toBe(4_000)
  })

  it("a wash-sale adjustment disallows the loss", () => {
    const r = withCapitalTransaction(baseReturn("single"), 5_000, 8_000, true, 3_000)
    const res = computeCapitalGains(r)
    expect(res.includedInIncome).toBe(0)
    expect(res.carryoverLong).toBe(0)
  })
})
