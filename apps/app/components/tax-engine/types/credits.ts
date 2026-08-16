/**
 * Credit inputs. CTC/ODC and EITC are derived from `dependents`; the blocks
 * here capture the extra data the other credits need.
 */

/** A student for education credits (Form 8863). */
export interface EducationStudent {
  id: string
  name: string
  /** Qualified tuition & related expenses paid in 2024. */
  qualifiedExpenses: number
  /** At least half-time, in a degree program, first 4 years → AOTC eligible. */
  aotcEligible: boolean
  /** Number of prior years AOTC has been claimed (4-year lifetime limit). */
  priorAotcYears: number
  /** Has a felony drug conviction (disqualifies AOTC). */
  felonyDrugConviction: boolean
}

/** Child & Dependent Care Credit inputs (Form 2441). */
export interface CareCredit {
  /** Total qualifying care expenses paid. */
  expenses: number
  /** Taxpayer's earned income (limits the credit). */
  taxpayerEarnedIncome: number
  /** Spouse's earned income (MFJ; both must have earned income). */
  spouseEarnedIncome: number
  /** Dependent care benefits received from an employer (W-2 box 10). */
  employerBenefits: number
}

/** Container for all credit-specific inputs. */
export interface CreditInputs {
  /** Education credits. */
  students: EducationStudent[]
  hasEducationExpenses: boolean
  /** Child & dependent care. */
  care: CareCredit
  hasCareExpenses: boolean
  /** Retirement Savings Contributions Credit (Form 8880) — voluntary contributions. */
  retirementContributions: number
  isFullTimeStudent: boolean
  /** Residential Clean Energy Credit (Form 5695) — qualified property cost. */
  cleanEnergyCost: number
  /** New clean vehicle / EV credit (Form 8936). */
  evCreditAmount: number
  /** Foreign tax paid (Form 1116 / direct credit). */
  foreignTaxPaid: number
  /** ACA marketplace: advance Premium Tax Credit reconciliation (Form 8962 / 1095-A). */
  hasMarketplaceCoverage: boolean
  advancePremiumTaxCredit: number
  premiumTaxCreditAllowed: number
}
