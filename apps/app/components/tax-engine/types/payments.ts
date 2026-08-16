/**
 * Tax payments and prior-year data (Form 1040 lines 25–26 + Form 2210 safe harbor).
 */
export interface Payments {
  /**
   * Additional federal income tax withheld NOT already captured on W-2 box 2 or
   * 1099 withholding boxes (the engine sums those from the income forms). Use this
   * for any withholding the user enters directly. Sch line / 1040 line 25.
   */
  additionalWithholding: number
  /** 2024 estimated tax payments made (Form 1040-ES). Line 26. */
  estimatedPayments: number
  /** Prior-year (2023) total tax — for the 2210 safe harbor (100%/110%). */
  priorYearTax?: number
  /** Prior-year (2023) AGI — determines whether the 110% safe harbor applies. */
  priorYearAgi?: number
}

/** Bank info for direct deposit / payment. SENSITIVE — never persisted. */
export interface BankInfo {
  routingNumber: string
  accountNumber: string
  accountType: "checking" | "savings"
}
