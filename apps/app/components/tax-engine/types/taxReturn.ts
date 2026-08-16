/**
 * TaxReturn2024 — the single source of truth that flows through the entire
 * engine: state -> engine -> result -> UI. Every input the calculator reads
 * lives here. The companion `makeEmptyReturn()` produces a clean starting state.
 */
import type { Address, Dependent, FilingStatus, StateCode, TaxpayerInfo } from "./filing"
import type { IncomeData } from "./income"
import type { Adjustments } from "./adjustments"
import type { ItemizedDeductions } from "./deductions"
import type { CreditInputs } from "./credits"
import type { BankInfo, Payments } from "./payments"

export interface TaxReturn2024 {
  meta: { taxYear: 2024; lastEdited: string }
  taxpayer: TaxpayerInfo
  spouse?: TaxpayerInfo
  address: Address
  filingStatus: FilingStatus
  dependents: Dependent[]
  residency: { state: StateCode | ""; partYearResident: boolean; stateWithholding: number }
  /** MFS only: lived apart from spouse for ALL of 2024 (affects SS taxability base amounts). */
  livedApartFromSpouse: boolean
  income: IncomeData
  adjustments: Adjustments
  itemized: ItemizedDeductions
  /** Force itemizing even when standard is larger (e.g. MFS spouse itemized). */
  forceItemize: boolean
  credits: CreditInputs
  payments: Payments
  /** SENSITIVE — never persisted. */
  bank?: BankInfo
}

function emptyTaxpayer(): TaxpayerInfo {
  return {
    firstName: "",
    lastName: "",
    ssn: "",
    dateOfBirth: "",
    occupation: "",
    blind: false,
    claimedAsDependentByAnother: false,
  }
}

/** Factory for a fresh, empty 2024 return. */
export function makeEmptyReturn(): TaxReturn2024 {
  return {
    meta: { taxYear: 2024, lastEdited: "" },
    taxpayer: emptyTaxpayer(),
    spouse: undefined,
    address: { line1: "", city: "", state: "", zip: "" },
    filingStatus: "single",
    dependents: [],
    residency: { state: "", partYearResident: false, stateWithholding: 0 },
    livedApartFromSpouse: false,
    income: {
      w2: [],
      f1099Int: [],
      f1099Div: [],
      f1099B: [],
      f1099R: [],
      f1099Ssa: [],
      f1099Nec: [],
      f1099Misc: [],
      f1099G: [],
      f1099Sa: [],
      scheduleC: [],
      scheduleE: [],
      otherIncome: 0,
      capitalLossCarryoverShort: 0,
      capitalLossCarryoverLong: 0,
      flags: {
        hasW2: false,
        hasInterest: false,
        hasDividends: false,
        hasCapitalGains: false,
        hasRetirementDistributions: false,
        hasSocialSecurity: false,
        hasSelfEmployment: false,
        hasRental: false,
        hasUnemployment: false,
        hasOtherIncome: false,
      },
    },
    adjustments: {
      educatorExpenses: 0,
      hsaContribution: 0,
      hsaCoverage: "none",
      sepSimpleContribution: 0,
      selfEmployedHealthInsurance: 0,
      traditionalIraContribution: 0,
      coveredByWorkplacePlan: false,
      spouseCoveredByWorkplacePlan: false,
      studentLoanInterest: 0,
    },
    itemized: {
      medicalExpenses: 0,
      stateLocalIncomeOrSalesTax: 0,
      realEstateTaxes: 0,
      personalPropertyTaxes: 0,
      mortgageInterest: 0,
      mortgageBalance: 0,
      mortgageAfterDec2017: true,
      charitableCash: 0,
      charitableNonCash: 0,
      casualtyLosses: 0,
    },
    forceItemize: false,
    credits: {
      students: [],
      hasEducationExpenses: false,
      care: {
        expenses: 0,
        taxpayerEarnedIncome: 0,
        spouseEarnedIncome: 0,
        employerBenefits: 0,
      },
      hasCareExpenses: false,
      retirementContributions: 0,
      isFullTimeStudent: false,
      cleanEnergyCost: 0,
      evCreditAmount: 0,
      foreignTaxPaid: 0,
      hasMarketplaceCoverage: false,
      advancePremiumTaxCredit: 0,
      premiumTaxCreditAllowed: 0,
    },
    payments: {
      additionalWithholding: 0,
      estimatedPayments: 0,
    },
    bank: undefined,
  }
}
