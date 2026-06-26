import { describe, it, expect } from "vitest"
import { computeEitc } from "../pipeline/eitc"
import { addQualifyingChild, baseReturn } from "../fixtures/builders"

/** Earned Income Tax Credit — 2024 tables, disqualifiers, and phaseout. */
describe("EITC", () => {
  it("2 children at the plateau → maximum credit $6,960", () => {
    let r = addQualifyingChild(baseReturn("single"))
    r = addQualifyingChild(r)
    const res = computeEitc({ r, earnedIncome: 18_000, agi: 18_000, investmentIncome: 0 })
    expect(res.credit).toBe(6_960)
  })

  it("1 child at the phase-in ceiling → maximum credit $4,213", () => {
    const r = addQualifyingChild(baseReturn("single"))
    const res = computeEitc({ r, earnedIncome: 12_390, agi: 12_390, investmentIncome: 0 })
    expect(res.credit).toBe(4_213)
  })

  it("childless (age 30) at the plateau → maximum credit $632", () => {
    const res = computeEitc({
      r: baseReturn("single"),
      earnedIncome: 8_260,
      agi: 8_260,
      investmentIncome: 0,
      taxpayerAge: 30,
    })
    expect(res.credit).toBe(632)
  })

  it("investment income over $11,600 disqualifies the credit", () => {
    let r = addQualifyingChild(baseReturn("single"))
    r = addQualifyingChild(r)
    const res = computeEitc({ r, earnedIncome: 18_000, agi: 18_000, investmentIncome: 12_000 })
    expect(res.credit).toBe(0)
    expect(res.eligible).toBe(false)
  })

  it("phaseout: 1 child, $40,000 income → $1,452", () => {
    const r = addQualifyingChild(baseReturn("single"))
    // 4,213 − 15.98% × (40,000 − 22,720) = 4,213 − 2,761.34 = 1,451.66 → $1,452
    const res = computeEitc({ r, earnedIncome: 40_000, agi: 40_000, investmentIncome: 0 })
    expect(res.credit).toBe(1_452)
  })

  it("MFS who did not live apart is ineligible", () => {
    const r = addQualifyingChild(baseReturn("mfs"))
    const res = computeEitc({ r, earnedIncome: 20_000, agi: 20_000, investmentIncome: 0 })
    expect(res.credit).toBe(0)
  })

  it("childless filer outside age 25–64 is ineligible", () => {
    const young = computeEitc({
      r: baseReturn("single"),
      earnedIncome: 8_260,
      agi: 8_260,
      investmentIncome: 0,
      taxpayerAge: 22,
    })
    const old = computeEitc({
      r: baseReturn("single"),
      earnedIncome: 8_260,
      agi: 8_260,
      investmentIncome: 0,
      taxpayerAge: 70,
    })
    expect(young.credit).toBe(0)
    expect(old.credit).toBe(0)
  })
})
