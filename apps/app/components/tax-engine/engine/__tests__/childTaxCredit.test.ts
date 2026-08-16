import { describe, it, expect } from "vitest"
import { computeChildTaxCredit } from "../pipeline/childTaxCredit"
import { addOtherDependent, addQualifyingChild, baseReturn } from "../fixtures/builders"

/**
 * Child Tax Credit / ODC / Additional CTC — verified against Schedule 8812 (2024).
 * Signature: computeChildTaxCredit(return, magi, taxAvailable, earnedIncome).
 */
describe("Child Tax Credit (Schedule 8812)", () => {
  it("2 children, MFJ, below phaseout, ample tax → $4,000 nonrefundable, no ACTC", () => {
    let r = baseReturn("mfj")
    r = addQualifyingChild(r)
    r = addQualifyingChild(r)
    const res = computeChildTaxCredit(r, 100_000, 20_000, 100_000)
    expect(res.tentativeCredit).toBe(4_000)
    expect(res.nonrefundable).toBe(4_000)
    expect(res.additionalChildTaxCredit).toBe(0)
  })

  it("phaseout: single, MAGI $210,000, 1 child → $1,500", () => {
    let r = baseReturn("single")
    r = addQualifyingChild(r)
    const res = computeChildTaxCredit(r, 210_000, 20_000, 100_000)
    // $2,000 − ceil(10,000/1,000)×$50 = 2,000 − 500 = 1,500
    expect(res.creditAfterPhaseout).toBe(1_500)
    expect(res.nonrefundable).toBe(1_500)
  })

  it("phaseout rounds the excess UP to the next $1,000", () => {
    let r = baseReturn("single")
    r = addQualifyingChild(r)
    // MAGI $210,500 → excess $10,500 → ceil = 11 steps × $50 = $550 → $1,450
    const res = computeChildTaxCredit(r, 210_500, 20_000, 100_000)
    expect(res.creditAfterPhaseout).toBe(1_450)
  })

  it("low income: 1 child, earned $10,000, no tax → ACTC = 15%×(10,000−2,500) = $1,125", () => {
    let r = baseReturn("single")
    r = addQualifyingChild(r)
    const res = computeChildTaxCredit(r, 10_000, 0, 10_000)
    expect(res.nonrefundable).toBe(0)
    expect(res.additionalChildTaxCredit).toBe(1_125)
  })

  it("ACTC is capped at $1,700 per qualifying child", () => {
    let r = baseReturn("single")
    r = addQualifyingChild(r)
    // earned $50,000 → 15% formula = $7,125, but cap = 1×$1,700 and leftover = $2,000
    const res = computeChildTaxCredit(r, 50_000, 0, 50_000)
    expect(res.additionalChildTaxCredit).toBe(1_700)
  })

  it("ODC ($500) is never refundable", () => {
    let r = baseReturn("single")
    r = addOtherDependent(r)
    const res = computeChildTaxCredit(r, 50_000, 0, 50_000)
    expect(res.tentativeCredit).toBe(500)
    expect(res.nonrefundable).toBe(0)
    expect(res.additionalChildTaxCredit).toBe(0)
  })

  it("partial nonrefundable + ACTC splits correctly (total benefit = $2,000)", () => {
    let r = baseReturn("single")
    r = addQualifyingChild(r)
    // tax available $500 → nonrefundable $500, leftover $1,500, ACTC = min(1,500, 1,700, 2,625)
    const res = computeChildTaxCredit(r, 20_000, 500, 20_000)
    expect(res.nonrefundable).toBe(500)
    expect(res.additionalChildTaxCredit).toBe(1_500)
  })
})
