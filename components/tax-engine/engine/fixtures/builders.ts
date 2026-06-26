/**
 * Test fixture builders — concise helpers to assemble a TaxReturn2024 from a
 * clean empty return. Keeps the golden tests readable.
 */
import { makeEmptyReturn, type TaxReturn2024 } from "../../types/taxReturn"
import type { FilingStatus } from "../../types/filing"

export function baseReturn(status: FilingStatus): TaxReturn2024 {
  const r = makeEmptyReturn()
  r.filingStatus = status
  return r
}

export function withW2(
  r: TaxReturn2024,
  wages: number,
  withholding = 0,
  owner: "taxpayer" | "spouse" = "taxpayer",
): TaxReturn2024 {
  r.income.flags.hasW2 = true
  r.income.w2.push({
    id: `w2-${r.income.w2.length}`,
    owner,
    employerName: "Employer",
    box1Wages: wages,
    box2FederalWithholding: withholding,
    box3SsWages: wages,
    box4SsWithheld: 0,
    box5MedicareWages: wages,
    box6MedicareWithheld: 0,
    box12: [],
    statutoryEmployee: false,
    box17StateWithholding: 0,
  })
  return r
}

export function addQualifyingChild(r: TaxReturn2024): TaxReturn2024 {
  r.dependents.push({
    id: `dep-${r.dependents.length}`,
    firstName: "Child",
    lastName: "Test",
    ssn: "",
    dateOfBirth: "2018-01-01",
    relationshipType: "child",
    relationship: "son",
    monthsLivedWithTaxpayer: 12,
    taxpayerProvidedOverHalfSupport: true,
    qualifiesForCTC: true,
    qualifiesForODC: false,
    qualifiesForEITC: true,
    qualifiesForCareCredit: false,
  })
  return r
}

export function withScheduleC(
  r: TaxReturn2024,
  net: number,
  owner: "taxpayer" | "spouse" = "taxpayer",
): TaxReturn2024 {
  r.income.flags.hasSelfEmployment = true
  r.income.scheduleC.push({
    id: `c-${r.income.scheduleC.length}`,
    owner,
    businessName: "Business",
    description: "Consulting",
    grossReceipts: net,
    costOfGoodsSold: 0,
    expenses: {},
    homeOfficeDeduction: 0,
    vehicleExpense: 0,
    isSSTB: false,
  })
  return r
}

export function withCapitalTransaction(
  r: TaxReturn2024,
  proceeds: number,
  costBasis: number,
  longTerm: boolean,
  washSaleAdjustment = 0,
): TaxReturn2024 {
  r.income.flags.hasCapitalGains = true
  r.income.f1099B.push({
    id: `b-${r.income.f1099B.length}`,
    description: "Sale",
    proceeds,
    costBasis,
    longTerm,
    washSaleAdjustment,
  })
  return r
}

export function withSocialSecurity(r: TaxReturn2024, benefits: number): TaxReturn2024 {
  r.income.flags.hasSocialSecurity = true
  r.income.f1099Ssa.push({
    id: `ssa-${r.income.f1099Ssa.length}`,
    owner: "taxpayer",
    box5NetBenefits: benefits,
    federalWithholding: 0,
  })
  return r
}

export function withQualifiedDividends(
  r: TaxReturn2024,
  ordinary: number,
  qualified: number,
): TaxReturn2024 {
  r.income.flags.hasDividends = true
  r.income.f1099Div.push({
    id: `div-${r.income.f1099Div.length}`,
    payer: "Brokerage",
    box1aOrdinaryDividends: ordinary,
    box1bQualifiedDividends: qualified,
    box2aCapitalGainDistributions: 0,
    box4FederalWithholding: 0,
  })
  return r
}

export function addOtherDependent(r: TaxReturn2024): TaxReturn2024 {
  r.dependents.push({
    id: `dep-${r.dependents.length}`,
    firstName: "Parent",
    lastName: "Test",
    ssn: "",
    dateOfBirth: "1955-01-01",
    relationshipType: "relative",
    relationship: "parent",
    monthsLivedWithTaxpayer: 12,
    taxpayerProvidedOverHalfSupport: true,
    qualifiesForCTC: false,
    qualifiesForODC: true,
    qualifiesForEITC: false,
    qualifiesForCareCredit: false,
  })
  return r
}
