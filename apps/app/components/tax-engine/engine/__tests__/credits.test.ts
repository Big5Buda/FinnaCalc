import { describe, it, expect } from "vitest"
import { computeCareCredit } from "../pipeline/careCredit"
import { computeEducationCredits } from "../pipeline/educationCredits"
import {
  computeCleanEnergyCredit,
  computeEvCredit,
  computeSaversCredit,
} from "../pipeline/otherCredits"
import { baseReturn } from "../fixtures/builders"
import type { FilingStatus } from "../../types/filing"
import type { TaxReturn2024 } from "../../types/taxReturn"

function withCarePerson(r: TaxReturn2024): TaxReturn2024 {
  r.dependents.push({
    id: `care-${r.dependents.length}`,
    firstName: "Kid",
    lastName: "",
    ssn: "",
    dateOfBirth: "2020-01-01",
    relationshipType: "child",
    relationship: "child",
    monthsLivedWithTaxpayer: 12,
    taxpayerProvidedOverHalfSupport: true,
    qualifiesForCTC: true,
    qualifiesForODC: false,
    qualifiesForEITC: true,
    qualifiesForCareCredit: true,
  })
  return r
}

function careReturn(status: FilingStatus, expenses: number, persons: number): TaxReturn2024 {
  let r = baseReturn(status)
  r.credits.hasCareExpenses = true
  r.credits.care = {
    expenses,
    taxpayerEarnedIncome: 100_000,
    spouseEarnedIncome: 100_000,
    employerBenefits: 0,
  }
  for (let i = 0; i < persons; i++) r = withCarePerson(r)
  return r
}

describe("Child & Dependent Care Credit (Form 2441)", () => {
  it("1 person, $4,000 expenses, AGI $20,000 → 32% of the $3,000 cap = $960", () => {
    expect(computeCareCredit(careReturn("single", 4_000, 1), 20_000)).toBe(960)
  })
  it("2 persons, $7,000 expenses, AGI $50,000 → 20% of the $6,000 cap = $1,200", () => {
    expect(computeCareCredit(careReturn("single", 7_000, 2), 50_000)).toBe(1_200)
  })
  it("AGI ≤ $15,000 → full 35% rate", () => {
    expect(computeCareCredit(careReturn("single", 3_000, 1), 10_000)).toBe(1_050)
  })
})

function eduReturn(status: FilingStatus, expenses: number, aotc: boolean): TaxReturn2024 {
  const r = baseReturn(status)
  r.credits.hasEducationExpenses = true
  r.credits.students = [
    {
      id: "s0",
      name: "Student",
      qualifiedExpenses: expenses,
      aotcEligible: aotc,
      priorAotcYears: 0,
      felonyDrugConviction: false,
    },
  ]
  return r
}

describe("Education credits (Form 8863)", () => {
  it("AOTC: $4,000 expenses → $2,500 ($1,500 nonrefundable + $1,000 refundable)", () => {
    const res = computeEducationCredits(eduReturn("single", 4_000, true), 50_000)
    expect(res.nonrefundable).toBe(1_500)
    expect(res.refundable).toBe(1_000)
  })
  it("LLC: $10,000 expenses → $2,000 nonrefundable", () => {
    const res = computeEducationCredits(eduReturn("single", 10_000, false), 50_000)
    expect(res.nonrefundable).toBe(2_000)
    expect(res.refundable).toBe(0)
  })
  it("AOTC halved at the MAGI phaseout midpoint ($85,000)", () => {
    const res = computeEducationCredits(eduReturn("single", 4_000, true), 85_000)
    expect(res.nonrefundable).toBe(750)
    expect(res.refundable).toBe(500)
  })
  it("MFS cannot claim education credits", () => {
    const res = computeEducationCredits(eduReturn("mfs", 4_000, true), 50_000)
    expect(res.nonrefundable).toBe(0)
    expect(res.refundable).toBe(0)
  })
})

function saverReturn(contribution: number): TaxReturn2024 {
  const r = baseReturn("single")
  r.credits.retirementContributions = contribution
  return r
}

describe("Saver's Credit (Form 8880)", () => {
  it("50% tier (AGI ≤ $23,000)", () => {
    expect(computeSaversCredit(saverReturn(2_000), 20_000)).toBe(1_000)
  })
  it("20% tier", () => {
    expect(computeSaversCredit(saverReturn(2_000), 24_000)).toBe(400)
  })
  it("10% tier with the $2,000 contribution cap", () => {
    expect(computeSaversCredit(saverReturn(3_000), 30_000)).toBe(200)
  })
  it("above the top AGI tier → $0", () => {
    expect(computeSaversCredit(saverReturn(2_000), 40_000)).toBe(0)
  })
  it("full-time student is ineligible", () => {
    const r = saverReturn(2_000)
    r.credits.isFullTimeStudent = true
    expect(computeSaversCredit(r, 20_000)).toBe(0)
  })
})

describe("Energy & EV credits", () => {
  it("Residential Clean Energy = 30% of cost", () => {
    const r = baseReturn("single")
    r.credits.cleanEnergyCost = 10_000
    expect(computeCleanEnergyCredit(r)).toBe(3_000)
  })
  it("EV credit allowed under the MAGI cap", () => {
    const r = baseReturn("single")
    r.credits.evCreditAmount = 7_500
    expect(computeEvCredit(r, 100_000)).toBe(7_500)
  })
  it("EV credit denied above the MAGI cap ($150,000 single)", () => {
    const r = baseReturn("single")
    r.credits.evCreditAmount = 7_500
    expect(computeEvCredit(r, 200_000)).toBe(0)
  })
})
