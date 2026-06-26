/**
 * Pure converter: interview answers → canonical TaxReturn2024 (the single source
 * of truth the calculation engine consumes). Keeping this conversion in one pure
 * function means the engine never depends on the UI shape.
 */
import { makeEmptyReturn, type TaxReturn2024 } from "../types/taxReturn"
import type { Answers } from "../types/question"
import type { FilingStatus, StateCode } from "../types/filing"

const n = (a: Answers, id: string) => (typeof a[id] === "number" ? (a[id] as number) : 0)
const b = (a: Answers, id: string) => a[id] === true
const intOf = (a: Answers, id: string) => Math.max(0, Math.floor(n(a, id)))

/** Convert an age at year-end 2024 into a mid-year DOB the engine can use. */
function dobFromAge(age: number): string {
  if (!age || age <= 0) return ""
  return `${2024 - age}-06-15`
}

export function buildReturn(a: Answers): TaxReturn2024 {
  const r = makeEmptyReturn()

  // ---- About you ----
  r.filingStatus = (typeof a.q_filing === "string" ? a.q_filing : "single") as FilingStatus
  r.livedApartFromSpouse = b(a, "q_lived_apart")
  r.taxpayer.dateOfBirth = dobFromAge(n(a, "q_age"))
  r.taxpayer.blind = b(a, "q_blind")
  r.taxpayer.claimedAsDependentByAnother = b(a, "q_claimed_dependent")
  if (r.filingStatus === "mfj" || r.filingStatus === "qss") {
    r.spouse = {
      ...r.taxpayer,
      dateOfBirth: dobFromAge(n(a, "q_spouse_age")),
      blind: b(a, "q_spouse_blind"),
    }
  }

  // ---- Dependents ----
  const kids = intOf(a, "q_qual_children")
  for (let i = 0; i < kids; i++) {
    r.dependents.push({
      id: `qc-${i}`,
      firstName: "Child",
      lastName: "",
      ssn: "",
      dateOfBirth: "2018-01-01",
      relationshipType: "child",
      relationship: "child",
      monthsLivedWithTaxpayer: 12,
      taxpayerProvidedOverHalfSupport: true,
      qualifiesForCTC: true,
      qualifiesForODC: false,
      qualifiesForEITC: true,
      qualifiesForCareCredit: false,
    })
  }
  const otherDeps = intOf(a, "q_other_deps")
  for (let i = 0; i < otherDeps; i++) {
    r.dependents.push({
      id: `od-${i}`,
      firstName: "Dependent",
      lastName: "",
      ssn: "",
      dateOfBirth: "1990-01-01",
      relationshipType: "relative",
      relationship: "relative",
      monthsLivedWithTaxpayer: 12,
      taxpayerProvidedOverHalfSupport: true,
      qualifiesForCTC: false,
      qualifiesForODC: true,
      qualifiesForEITC: false,
      qualifiesForCareCredit: false,
    })
  }

  // ---- Job income (W-2) ----
  const wages = n(a, "q_wages")
  const withholding = n(a, "q_withholding")
  if (wages > 0 || withholding > 0) {
    r.income.flags.hasW2 = true
    r.income.w2.push({
      id: "w2-0",
      owner: "taxpayer",
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
  }

  // ---- Self-employment ----
  if (n(a, "q_se_profit") !== 0) {
    r.income.flags.hasSelfEmployment = true
    r.income.scheduleC.push({
      id: "c-0",
      owner: "taxpayer",
      businessName: "Self-employment",
      description: "Business",
      grossReceipts: n(a, "q_se_profit"),
      costOfGoodsSold: 0,
      expenses: {},
      homeOfficeDeduction: 0,
      vehicleExpense: 0,
      isSSTB: b(a, "q_se_sstb"),
    })
  }
  r.adjustments.selfEmployedHealthInsurance = n(a, "q_se_health")

  // ---- Investments ----
  const interest = n(a, "q_interest")
  const taxExempt = n(a, "q_tax_exempt")
  if (interest > 0 || taxExempt > 0) {
    r.income.flags.hasInterest = true
    r.income.f1099Int.push({
      id: "int-0",
      payer: "Bank",
      box1Interest: interest,
      box3UsTreasuryInterest: 0,
      box8TaxExemptInterest: taxExempt,
      box4FederalWithholding: 0,
    })
  }
  const ordDiv = n(a, "q_ord_div")
  const qualDiv = n(a, "q_qual_div")
  const capDist = n(a, "q_capgain_dist")
  if (ordDiv > 0 || qualDiv > 0 || capDist > 0) {
    r.income.flags.hasDividends = true
    r.income.f1099Div.push({
      id: "div-0",
      payer: "Brokerage",
      box1aOrdinaryDividends: Math.max(ordDiv, qualDiv),
      box1bQualifiedDividends: qualDiv,
      box2aCapitalGainDistributions: capDist,
      box4FederalWithholding: 0,
    })
  }
  const ltcg = n(a, "q_ltcg")
  const stcg = n(a, "q_stcg")
  if (ltcg !== 0 || stcg !== 0) {
    r.income.flags.hasCapitalGains = true
    if (ltcg !== 0)
      r.income.f1099B.push({ id: "b-lt", description: "Long-term", proceeds: ltcg > 0 ? ltcg : 0, costBasis: ltcg < 0 ? -ltcg : 0, longTerm: true })
    if (stcg !== 0)
      r.income.f1099B.push({ id: "b-st", description: "Short-term", proceeds: stcg > 0 ? stcg : 0, costBasis: stcg < 0 ? -stcg : 0, longTerm: false })
  }

  // ---- Retirement & Social Security ----
  if (n(a, "q_ss_benefits") > 0) {
    r.income.flags.hasSocialSecurity = true
    r.income.f1099Ssa.push({ id: "ssa-0", owner: "taxpayer", box5NetBenefits: n(a, "q_ss_benefits"), federalWithholding: 0 })
  }
  if (n(a, "q_retire_taxable") > 0) {
    r.income.flags.hasRetirementDistributions = true
    r.income.f1099R.push({
      id: "r-0",
      payer: "Plan",
      box1GrossDistribution: n(a, "q_retire_taxable"),
      box2aTaxableAmount: n(a, "q_retire_taxable"),
      box4FederalWithholding: 0,
      box7DistributionCode: b(a, "q_retire_early") ? "1" : "7",
      iraSepSimple: false,
    })
  }

  // ---- Other income ----
  if (n(a, "q_unemployment") > 0) {
    r.income.flags.hasUnemployment = true
    r.income.f1099G.push({ id: "g-0", payer: "State", box1Unemployment: n(a, "q_unemployment"), box2StateRefund: 0, box4FederalWithholding: 0 })
  }
  if (n(a, "q_other_income") > 0) {
    r.income.flags.hasOtherIncome = true
    r.income.otherIncome = n(a, "q_other_income")
  }

  // ---- Adjustments ----
  r.adjustments.studentLoanInterest = n(a, "q_student_loan")
  r.adjustments.educatorExpenses = n(a, "q_educator")
  const hsa = a.q_hsa_coverage
  r.adjustments.hsaCoverage = hsa === "self-only" || hsa === "family" ? hsa : "none"
  r.adjustments.hsaContribution = n(a, "q_hsa_contribution")
  r.adjustments.traditionalIraContribution = n(a, "q_ira_contribution")
  r.adjustments.coveredByWorkplacePlan = b(a, "q_ira_covered")

  // ---- Deductions ----
  if (b(a, "q_itemize")) {
    r.itemized.mortgageInterest = n(a, "q_mortgage_interest")
    r.itemized.mortgageBalance = n(a, "q_mortgage_balance")
    r.itemized.stateLocalIncomeOrSalesTax = n(a, "q_salt")
    r.itemized.realEstateTaxes = n(a, "q_property_tax")
    r.itemized.charitableCash = n(a, "q_charitable")
    r.itemized.medicalExpenses = n(a, "q_medical")
  }

  // ---- Credits ----
  const careChildren = intOf(a, "q_care_children")
  if (n(a, "q_care_expenses") > 0 && careChildren > 0) {
    r.credits.hasCareExpenses = true
    const earned = wages + Math.max(0, n(a, "q_se_profit"))
    r.credits.care = { expenses: n(a, "q_care_expenses"), taxpayerEarnedIncome: earned, spouseEarnedIncome: earned, employerBenefits: 0 }
    let marked = 0
    for (const d of r.dependents) {
      if (marked >= careChildren) break
      if (d.qualifiesForCTC) {
        d.qualifiesForCareCredit = true
        marked++
      }
    }
    for (let i = marked; i < careChildren; i++) {
      r.dependents.push({
        id: `care-${i}`,
        firstName: "Child",
        lastName: "",
        ssn: "",
        dateOfBirth: "2020-01-01",
        relationshipType: "child",
        relationship: "child",
        monthsLivedWithTaxpayer: 12,
        taxpayerProvidedOverHalfSupport: true,
        qualifiesForCTC: false,
        qualifiesForODC: false,
        qualifiesForEITC: false,
        qualifiesForCareCredit: true,
      })
    }
  }
  if (n(a, "q_edu_expenses") > 0) {
    r.credits.hasEducationExpenses = true
    r.credits.students = [
      { id: "s0", name: "Student", qualifiedExpenses: n(a, "q_edu_expenses"), aotcEligible: b(a, "q_edu_aotc"), priorAotcYears: 0, felonyDrugConviction: false },
    ]
  }
  r.credits.retirementContributions = n(a, "q_savers_contrib")
  r.credits.cleanEnergyCost = n(a, "q_clean_energy")
  r.credits.evCreditAmount = n(a, "q_ev_credit")

  // ---- State residency ----
  if (typeof a.q_state === "string" && a.q_state !== "") {
    r.residency.state = a.q_state as StateCode
    r.residency.stateWithholding = n(a, "q_state_withholding")
  }

  // ---- Payments ----
  r.payments.estimatedPayments = n(a, "q_est_payments")
  r.payments.additionalWithholding = n(a, "q_extra_withholding")
  if (n(a, "q_prior_tax") > 0) r.payments.priorYearTax = n(a, "q_prior_tax")
  if (n(a, "q_prior_agi") > 0) r.payments.priorYearAgi = n(a, "q_prior_agi")

  return r
}
