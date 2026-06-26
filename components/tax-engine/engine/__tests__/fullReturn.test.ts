import { describe, it, expect } from "vitest"
import { calculateFederalTax } from "../calculator"
import {
  addQualifyingChild,
  baseReturn,
  withCapitalTransaction,
  withQualifiedDividends,
  withScheduleC,
  withSocialSecurity,
  withW2,
} from "../fixtures/builders"

/**
 * End-to-end golden fixtures — each value hand-computed from the 2024 rules and
 * asserted to the whole dollar (AGI → taxable income → tax → credits → refund).
 */
describe("Full return: simple single W-2 filer (refund)", () => {
  // Wages $60,000, withholding $6,000, standard deduction, no dependents.
  const res = calculateFederalTax(withW2(baseReturn("single"), 60_000, 6_000))

  it("AGI = $60,000", () => expect(res.agi).toBe(60_000))
  it("standard deduction = $14,600", () => expect(res.deductionUsed).toBe("standard"))
  it("taxable income = $45,400", () => expect(res.taxableIncome).toBe(45_400))
  it("regular tax (Tax Table, midpoint $45,425) = $5,219", () =>
    expect(res.regularTax).toBe(5_219))
  it("uses the Tax Table", () => expect(res.usedTaxTable).toBe(true))
  it("total tax = $5,219", () => expect(res.totalTax).toBe(5_219))
  it("refund = $781", () => {
    expect(res.refundOrOwed).toBe(781)
    expect(res.owes).toBe(false)
  })
})

describe("Full return: MFJ with 2 children (CTC nonrefundable)", () => {
  // Wages $90,000, withholding $5,000, 2 qualifying children.
  let r = withW2(baseReturn("mfj"), 90_000, 5_000)
  r = addQualifyingChild(r)
  r = addQualifyingChild(r)
  const res = calculateFederalTax(r)

  it("taxable income = $60,800", () => expect(res.taxableIncome).toBe(60_800))
  it("regular tax (Tax Table, midpoint $60,825) = $6,835", () =>
    expect(res.regularTax).toBe(6_835))
  it("CTC nonrefundable = $4,000", () =>
    expect(res.nonrefundableCredits.childTaxCredit).toBe(4_000))
  it("total tax = $2,835", () => expect(res.totalTax).toBe(2_835))
  it("refund = $2,165", () => expect(res.refundOrOwed).toBe(2_165))
})

describe("Full return: low-income single, 2 children (refundable ACTC)", () => {
  // Wages $18,000, no withholding, 2 qualifying children.
  let r = withW2(baseReturn("single"), 18_000, 0)
  r = addQualifyingChild(r)
  r = addQualifyingChild(r)
  const res = calculateFederalTax(r)

  it("taxable income = $3,400", () => expect(res.taxableIncome).toBe(3_400))
  it("regular tax (Tax Table, midpoint $3,425) = $343", () =>
    expect(res.regularTax).toBe(343))
  it("CTC nonrefundable absorbs the $343 of tax", () =>
    expect(res.nonrefundableCredits.childTaxCredit).toBe(343))
  it("total tax = $0", () => expect(res.totalTax).toBe(0))
  it("refundable ACTC = $2,325 (15% × (18,000 − 2,500))", () =>
    expect(res.refundableCredits.additionalChildTaxCredit).toBe(2_325))
  it("EITC (2 children, $18,000 earned) = $6,960 max credit", () =>
    expect(res.refundableCredits.earnedIncomeCredit).toBe(6_960))
  it("refund = ACTC + EITC = $9,285", () => expect(res.refundOrOwed).toBe(9_285))
})

describe("Full return: high-income single, itemized deductions (balance due)", () => {
  // Wages $150,000, withholding $20,000; itemize mortgage + SALT + charity.
  const r = withW2(baseReturn("single"), 150_000, 20_000)
  r.itemized.mortgageInterest = 15_000
  r.itemized.stateLocalIncomeOrSalesTax = 12_000
  r.itemized.realEstateTaxes = 6_000 // SALT total $18,000 → capped at $10,000
  r.itemized.charitableCash = 3_000
  const res = calculateFederalTax(r)

  it("itemizes (28,000 > 14,600 standard)", () =>
    expect(res.deductionUsed).toBe("itemized"))
  it("itemized deduction = $28,000 (SALT capped)", () =>
    expect(res.deductionAmount).toBe(28_000))
  it("taxable income = $122,000", () => expect(res.taxableIncome).toBe(122_000))
  it("regular tax (Computation Worksheet) = $22,323", () => {
    expect(res.usedTaxTable).toBe(false)
    expect(res.regularTax).toBe(22_323)
  })
  it("owes $2,323", () => {
    expect(res.owes).toBe(true)
    expect(res.refundOrOwed).toBe(-2_323)
  })
})

describe("Edge cases", () => {
  it("zero income → zero tax, zero refund", () => {
    const res = calculateFederalTax(baseReturn("single"))
    expect(res.totalTax).toBe(0)
    expect(res.refundOrOwed).toBe(0)
  })

  it("flags W-2 income with zero withholding", () => {
    const res = calculateFederalTax(withW2(baseReturn("single"), 50_000, 0))
    expect(res.auditFlags.some((f) => f.message.includes("no federal tax was withheld"))).toBe(
      true,
    )
  })
})

describe("Phase 2/3 — Full return: self-employed single (SE tax + 50% deduction + QBI)", () => {
  // Schedule C net $80,000, no W-2, no withholding.
  const res = calculateFederalTax(withScheduleC(baseReturn("single"), 80_000))

  it("self-employment tax = $11,304 (73,880 net earnings × 15.3%)", () =>
    expect(res.seTax).toBe(11_304))
  it("AGI = $74,348 (income $80,000 − half of SE tax $5,652)", () =>
    expect(res.agi).toBe(74_348))
  it("QBI deduction = $11,950 (20% of QBI, capped by 20% of taxable income)", () =>
    expect(res.qbiDeduction).toBe(11_950))
  it("taxable income = $47,798 (after standard deduction and QBI)", () =>
    expect(res.taxableIncome).toBe(47_798))
  it("regular income tax = $5,564", () => expect(res.regularTax).toBe(5_564))
  it("total tax = income tax + SE tax = $16,868", () => expect(res.totalTax).toBe(16_868))
  it("owes $16,868 (no withholding)", () => expect(res.refundOrOwed).toBe(-16_868))
})

describe("Phase 2 — Full return: retiree with Social Security + qualified dividends", () => {
  // MFJ, $40,000 SS benefits, $20,000 dividends (all qualified), $5,000 interest.
  let r = withQualifiedDividends(baseReturn("mfj"), 20_000, 20_000)
  r = withSocialSecurity(r, 40_000)
  r.income.flags.hasInterest = true
  r.income.f1099Int.push({
    id: "int-0",
    payer: "Bank",
    box1Interest: 5_000,
    box3UsTreasuryInterest: 0,
    box8TaxExemptInterest: 0,
    box4FederalWithholding: 0,
  })
  const res = calculateFederalTax(r)

  it("total income includes $6,850 of taxable Social Security → $31,850", () =>
    expect(res.totalIncome).toBe(31_850))
  it("taxable income = $2,650 (after MFJ $29,200 standard deduction)", () =>
    expect(res.taxableIncome).toBe(2_650))
  it("uses the Qualified Dividends worksheet; tax = $0 (preferential income in the 0% bracket)", () => {
    expect(res.usedQualDivWorksheet).toBe(true)
    expect(res.regularTax).toBe(0)
    expect(res.totalTax).toBe(0)
  })
})

describe("Phase 3 — Full return: high earner (NIIT + Additional Medicare Tax)", () => {
  // Single, $300,000 wages ($60,000 withheld), $50,000 taxable interest.
  const r = withW2(baseReturn("single"), 300_000, 60_000)
  r.income.flags.hasInterest = true
  r.income.f1099Int.push({
    id: "int-0",
    payer: "Bank",
    box1Interest: 50_000,
    box3UsTreasuryInterest: 0,
    box8TaxExemptInterest: 0,
    box4FederalWithholding: 0,
  })
  const res = calculateFederalTax(r)

  it("regular tax = $87,765", () => expect(res.regularTax).toBe(87_765))
  it("Additional Medicare Tax = $900 (0.9% × wages over $200k)", () =>
    expect(res.additionalMedicareTax).toBe(900))
  it("NIIT = $1,900 (3.8% × $50,000 investment income)", () => expect(res.niit).toBe(1_900))
  it("total tax = $90,565", () => expect(res.totalTax).toBe(90_565))
  it("owes $30,565", () => expect(res.refundOrOwed).toBe(-30_565))
})

describe("Phase 2 — Full return: capital loss with carryover", () => {
  // Single, $60,000 wages ($6,000 withheld), $10,000 long-term capital loss.
  let r = withW2(baseReturn("single"), 60_000, 6_000)
  r = withCapitalTransaction(r, 0, 10_000, true)
  const res = calculateFederalTax(r)

  it("only $3,000 of the loss is deductible this year → AGI $57,000", () =>
    expect(res.agi).toBe(57_000))
  it("taxable income = $42,400", () => expect(res.taxableIncome).toBe(42_400))
  it("regular tax = $4,859", () => expect(res.regularTax).toBe(4_859))
  it("refund = $1,141", () => expect(res.refundOrOwed).toBe(1_141))
  it("$7,000 long-term loss carries over to next year", () =>
    expect(res.capitalLossCarryover.longTerm).toBe(7_000))
})
