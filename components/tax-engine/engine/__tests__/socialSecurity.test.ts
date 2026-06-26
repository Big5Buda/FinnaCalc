import { describe, it, expect } from "vitest"
import { computeTaxableSocialSecurity } from "../pipeline/socialSecurity"

/** Social Security Benefits Worksheet — 0% / 50% / 85% tiers. */
const ss = (over: Partial<Parameters<typeof computeTaxableSocialSecurity>[0]>) =>
  computeTaxableSocialSecurity({
    benefits: 0,
    otherIncome: 0,
    taxExemptInterest: 0,
    adjustmentsForProvisional: 0,
    status: "single",
    livedApartFromSpouse: false,
    ...over,
  })

describe("Social Security taxability", () => {
  it("low income → 0% taxable (provisional ≤ $25,000 single)", () => {
    expect(ss({ benefits: 20_000, otherIncome: 10_000 })).toBe(0)
  })

  it("middle tier → 50% of the excess over base1, capped at half the benefits", () => {
    // provisional = 20,000 + 10,000 = 30,000 → 0.5 × (30,000 − 25,000) = 2,500
    expect(ss({ benefits: 20_000, otherIncome: 20_000 })).toBe(2_500)
  })

  it("high income → 85% cap on benefits", () => {
    // provisional = 60,000 → 0.85 × 20,000 = 17,000 (cap binds)
    expect(ss({ benefits: 20_000, otherIncome: 50_000 })).toBe(17_000)
  })

  it("MFJ tier computation", () => {
    // provisional = 55,000; tier1 = 6,000; 0.85×(55,000−44,000)+6,000 = 15,350
    expect(ss({ benefits: 30_000, otherIncome: 40_000, status: "mfj" })).toBe(15_350)
  })

  it("above-the-line adjustments reduce provisional income", () => {
    // provisional = 50,000 + 10,000 − 30,000 = 30,000 → 50% tier = 2,500
    expect(ss({ benefits: 20_000, otherIncome: 50_000, adjustmentsForProvisional: 30_000 })).toBe(
      2_500,
    )
  })

  it("tax-exempt interest counts toward provisional income", () => {
    // provisional = 20,000 + 10,000(tax-exempt) + 10,000(half) = 40,000 → 0.85×6,000+4,500 = 9,600
    expect(ss({ benefits: 20_000, otherIncome: 20_000, taxExemptInterest: 10_000 })).toBe(9_600)
  })
})
