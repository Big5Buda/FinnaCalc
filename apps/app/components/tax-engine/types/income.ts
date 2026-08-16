/**
 * Income source types. Every field maps to a specific information return box
 * or Schedule line. The engine reads these only when the corresponding income
 * flag is set, so hidden/irrelevant sources never affect the calculation.
 */

/** A W-2 (wage statement). Box numbers per the 2024 W-2. */
export interface W2 {
  id: string
  /** "taxpayer" or "spouse" — relevant for MFJ Additional Medicare Tax per-person wage base. */
  owner: "taxpayer" | "spouse"
  employerName: string
  /** Box 1 — wages, tips, other compensation. */
  box1Wages: number
  /** Box 2 — federal income tax withheld. */
  box2FederalWithholding: number
  /** Box 3 — Social Security wages. */
  box3SsWages: number
  /** Box 4 — Social Security tax withheld. */
  box4SsWithheld: number
  /** Box 5 — Medicare wages and tips (basis for Additional Medicare Tax). */
  box5MedicareWages: number
  /** Box 6 — Medicare tax withheld (includes any Additional Medicare withheld). */
  box6MedicareWithheld: number
  /** Box 12 codes that matter to the engine (D=401k, W=HSA employer/employee, etc.). */
  box12: Array<{ code: string; amount: number }>
  /** Box 13 "Statutory employee" — moves wages to Schedule C. */
  statutoryEmployee: boolean
  /** Box 17 — state income tax withheld (state engine, later phase). */
  box17StateWithholding: number
}

/** 1099-INT — interest income. */
export interface Form1099Int {
  id: string
  payer: string
  /** Box 1 — taxable interest. */
  box1Interest: number
  /** Box 3 — interest on U.S. savings bonds / Treasury obligations (state-exempt). */
  box3UsTreasuryInterest: number
  /** Box 8 — tax-exempt interest (feeds SS taxability & some MAGIs, not taxable income). */
  box8TaxExemptInterest: number
  /** Box 4 — federal income tax withheld (backup withholding). */
  box4FederalWithholding: number
}

/** 1099-DIV — dividends. Qualified portion is taxed at capital-gains rates. */
export interface Form1099Div {
  id: string
  payer: string
  /** Box 1a — total ordinary dividends. */
  box1aOrdinaryDividends: number
  /** Box 1b — qualified dividends (subset of 1a, capital-gain rates). */
  box1bQualifiedDividends: number
  /** Box 2a — total capital gain distributions (long-term). */
  box2aCapitalGainDistributions: number
  /** Box 4 — federal income tax withheld. */
  box4FederalWithholding: number
}

/** One sale lot from a 1099-B / Form 8949 capital transaction. */
export interface CapitalTransaction {
  id: string
  description: string
  proceeds: number
  costBasis: number
  /** true = held > 1 year (long-term); false = short-term (ordinary rates). */
  longTerm: boolean
  /** Wash-sale disallowed loss adjustment (8949 col g), if any. */
  washSaleAdjustment?: number
}

/** 1099-R — distributions from pensions, annuities, retirement, IRAs. */
export interface Form1099R {
  id: string
  payer: string
  /** Box 1 — gross distribution. */
  box1GrossDistribution: number
  /** Box 2a — taxable amount. */
  box2aTaxableAmount: number
  /** Box 4 — federal income tax withheld. */
  box4FederalWithholding: number
  /** Box 7 — distribution code (e.g. "1" = early, no known exception → 10% penalty). */
  box7DistributionCode: string
  /** IRA/SEP/SIMPLE checkbox. */
  iraSepSimple: boolean
}

/** 1099-SSA — Social Security benefits (taxability computed via worksheet). */
export interface Form1099Ssa {
  id: string
  owner: "taxpayer" | "spouse"
  /** Box 5 — net benefits for the year. */
  box5NetBenefits: number
  /** Federal income tax withheld (voluntary). */
  federalWithholding: number
}

/** 1099-NEC — nonemployee compensation (flows to Schedule C). */
export interface Form1099Nec {
  id: string
  payer: string
  /** Box 1 — nonemployee compensation. */
  box1Compensation: number
  box4FederalWithholding: number
}

/** 1099-MISC — miscellaneous income (rents, royalties, other). */
export interface Form1099Misc {
  id: string
  payer: string
  box1Rents: number
  box2Royalties: number
  box3OtherIncome: number
  box4FederalWithholding: number
}

/** 1099-G — government payments (unemployment, state refunds). */
export interface Form1099G {
  id: string
  payer: string
  /** Box 1 — unemployment compensation (fully taxable for 2024). */
  box1Unemployment: number
  /** Box 2 — state/local income tax refunds (taxable only if itemized last year). */
  box2StateRefund: number
  box4FederalWithholding: number
}

/** 1099-SA — distributions from an HSA (Form 8889). */
export interface Form1099Sa {
  id: string
  /** Box 1 — gross distribution. */
  box1GrossDistribution: number
  /** Portion used for unqualified expenses (taxable + 20% penalty). */
  unqualifiedAmount: number
}

/** A single Schedule C business. */
export interface ScheduleC {
  id: string
  owner: "taxpayer" | "spouse"
  businessName: string
  /** Principal business / activity description. */
  description: string
  /** Line 1 — gross receipts. */
  grossReceipts: number
  /** Line 4 — cost of goods sold. */
  costOfGoodsSold: number
  /** Itemized expense lines (Part II), keyed by category. */
  expenses: Record<string, number>
  /** Home office deduction (Form 8829 or simplified $5/sqft up to 300 sqft). */
  homeOfficeDeduction: number
  /** Vehicle expenses (actual or standard mileage). */
  vehicleExpense: number
  /** Whether the activity is a specified service trade or business (QBI/SSTB). */
  isSSTB: boolean
}

/** A single Schedule E property / passthrough (rental, royalty, K-1). */
export interface ScheduleE {
  id: string
  description: string
  /** Net rental/royalty/passthrough income or loss for the property. */
  netIncome: number
}

/** Container for all income on the return. */
export interface IncomeData {
  w2: W2[]
  f1099Int: Form1099Int[]
  f1099Div: Form1099Div[]
  f1099B: CapitalTransaction[]
  f1099R: Form1099R[]
  f1099Ssa: Form1099Ssa[]
  f1099Nec: Form1099Nec[]
  f1099Misc: Form1099Misc[]
  f1099G: Form1099G[]
  f1099Sa: Form1099Sa[]
  scheduleC: ScheduleC[]
  scheduleE: ScheduleE[]
  /** Catch-all other income (Schedule 1 line 8z). */
  otherIncome: number
  /** Prior-year capital loss carryover into 2024 (Schedule D). */
  capitalLossCarryoverShort: number
  capitalLossCarryoverLong: number
  /** Gating flags driven by the interview; the engine only reads gated sources. */
  flags: {
    hasW2: boolean
    hasInterest: boolean
    hasDividends: boolean
    hasCapitalGains: boolean
    hasRetirementDistributions: boolean
    hasSocialSecurity: boolean
    hasSelfEmployment: boolean
    hasRental: boolean
    hasUnemployment: boolean
    hasOtherIncome: boolean
  }
}
