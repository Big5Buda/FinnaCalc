/**
 * Above-the-line adjustments to income — Schedule 1 Part II.
 * These reduce gross income to arrive at AGI.
 */
export interface Adjustments {
  /** Educator expenses — up to $300 ($600 MFJ if both educators). Sch 1 line 11. */
  educatorExpenses: number
  /** HSA contributions (Form 8889), excluding employer/cafeteria-plan amounts. Sch 1 line 13. */
  hsaContribution: number
  /** Whether HSA coverage is self-only or family (limits differ). */
  hsaCoverage: "self-only" | "family" | "none"
  /** Deductible self-employed SEP/SIMPLE/qualified plan contributions. Sch 1 line 16. */
  sepSimpleContribution: number
  /** Self-employed health insurance premiums. Sch 1 line 17. */
  selfEmployedHealthInsurance: number
  /** Traditional IRA contributions the filer wants to deduct. Sch 1 line 20. */
  traditionalIraContribution: number
  /** Whether the taxpayer is covered by a workplace retirement plan (affects IRA deductibility). */
  coveredByWorkplacePlan: boolean
  /** Whether the spouse is covered by a workplace plan (MFJ). */
  spouseCoveredByWorkplacePlan: boolean
  /** Student loan interest paid — up to $2,500, MAGI phaseout. Sch 1 line 21. */
  studentLoanInterest: number
}
