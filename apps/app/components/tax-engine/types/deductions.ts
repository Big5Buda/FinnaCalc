/**
 * Itemized deductions — Schedule A.
 * The engine compares the itemized total (with all IRS limits applied) against
 * the standard deduction and uses the larger, unless MFS forces a match.
 */
export interface ItemizedDeductions {
  /** Unreimbursed medical/dental expenses (subject to 7.5%-of-AGI floor). Sch A line 1. */
  medicalExpenses: number
  /** State & local income (or sales) taxes paid. Part of the SALT cap. Sch A line 5a. */
  stateLocalIncomeOrSalesTax: number
  /** Real estate (property) taxes. Part of the SALT cap. Sch A line 5b. */
  realEstateTaxes: number
  /** Personal property taxes. Part of the SALT cap. Sch A line 5c. */
  personalPropertyTaxes: number
  /** Home mortgage interest (subject to the $750k acquisition-debt limit). Sch A line 8. */
  mortgageInterest: number
  /** Mortgage balance — used to apply the $750k interest-deductibility limit. */
  mortgageBalance: number
  /** Whether the mortgage originated after 12/15/2017 ($750k limit vs $1M grandfathered). */
  mortgageAfterDec2017: boolean
  /** Cash charitable contributions (60%-of-AGI limit). Sch A line 11. */
  charitableCash: number
  /** Non-cash / appreciated-property contributions (30%-of-AGI limit). Sch A line 12. */
  charitableNonCash: number
  /** Casualty/theft losses from a federally declared disaster. Sch A line 15. */
  casualtyLosses: number
}
