/**
 * Pure structuring of a TaxCalculationResult into print/PDF-ready groups. No
 * React, no I/O — the printable view and any future PDF generator both read this.
 */
import type { FilingStatus } from "../types/filing"
import type { TaxCalculationResult } from "../types/result"

export interface SummaryLine {
  label: string
  amount: number
  formRef?: string
}
export interface SummaryGroup {
  title: string
  lines: SummaryLine[]
}
export interface Form1040Summary {
  taxYear: 2024
  filingStatusLabel: string
  headline: { label: string; amount: number; owes: boolean }
  groups: SummaryGroup[]
  state?: {
    name: string
    hasIncomeTax: boolean
    tax: number
    refundOrOwed: number
    note?: string
  }
}

const FILING_LABELS: Record<FilingStatus, string> = {
  single: "Single",
  mfj: "Married filing jointly",
  mfs: "Married filing separately",
  hoh: "Head of household",
  qss: "Qualifying surviving spouse",
}

/** Title-case a camelCase credit key, e.g. "childTaxCredit" → "Child tax credit". */
function labelizeCredit(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1").toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function build1040Summary(r: TaxCalculationResult): Form1040Summary {
  const groups: SummaryGroup[] = []

  groups.push({
    title: "Income",
    lines: [
      { label: "Total income", amount: r.totalIncome, formRef: "1040 line 9" },
      { label: "Adjustments to income", amount: r.totalAdjustments, formRef: "Schedule 1" },
      { label: "Adjusted gross income (AGI)", amount: r.agi, formRef: "1040 line 11" },
    ],
  })

  const deductionLines: SummaryLine[] = [
    {
      label: r.deductionUsed === "itemized" ? "Itemized deductions" : "Standard deduction",
      amount: r.deductionAmount,
      formRef: "1040 line 12",
    },
  ]
  if (r.qbiDeduction > 0)
    deductionLines.push({ label: "QBI deduction", amount: r.qbiDeduction, formRef: "1040 line 13" })
  deductionLines.push({ label: "Taxable income", amount: r.taxableIncome, formRef: "1040 line 15" })
  groups.push({ title: "Deductions", lines: deductionLines })

  const taxLines: SummaryLine[] = [{ label: "Income tax", amount: r.regularTax, formRef: "1040 line 16" }]
  if (r.amt > 0) taxLines.push({ label: "Alternative minimum tax", amount: r.amt, formRef: "Schedule 2" })
  for (const [key, amount] of Object.entries(r.nonrefundableCredits)) {
    taxLines.push({ label: `− ${labelizeCredit(key)}`, amount: -amount })
  }
  if (r.seTax > 0) taxLines.push({ label: "Self-employment tax", amount: r.seTax, formRef: "Schedule 2" })
  if (r.additionalMedicareTax > 0)
    taxLines.push({ label: "Additional Medicare tax", amount: r.additionalMedicareTax })
  if (r.niit > 0) taxLines.push({ label: "Net investment income tax", amount: r.niit })
  taxLines.push({ label: "Total tax", amount: r.totalTax, formRef: "1040 line 24" })
  groups.push({ title: "Tax & credits", lines: taxLines })

  const payLines: SummaryLine[] = []
  for (const [key, amount] of Object.entries(r.refundableCredits)) {
    payLines.push({ label: labelizeCredit(key), amount })
  }
  payLines.push({ label: "Total payments & refundable credits", amount: r.totalPayments, formRef: "1040 line 33" })
  groups.push({ title: "Payments", lines: payLines })

  return {
    taxYear: 2024,
    filingStatusLabel: FILING_LABELS[r.filingStatus],
    headline: {
      label: r.owes ? "Estimated balance due" : "Estimated federal refund",
      amount: Math.abs(r.refundOrOwed),
      owes: r.owes,
    },
    groups,
    state:
      r.state && r.state.supported
        ? {
            name: r.state.name,
            hasIncomeTax: r.state.hasIncomeTax,
            tax: r.state.tax,
            refundOrOwed: r.state.refundOrOwed,
            note: r.state.note,
          }
        : undefined,
  }
}
