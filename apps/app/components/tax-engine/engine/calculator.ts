/**
 * calculateFederalTax — the pure orchestrator.
 *
 * Runs the ordered IRS computation pipeline and assembles a fully traced
 * TaxCalculationResult. No side effects, no I/O — deterministic output.
 *
 * PHASE 2 SCOPE: wages + interest + dividends (ordinary & qualified), capital
 * gains (Schedule D, $3k loss limit + carryover), Schedule C + self-employment
 * tax (Schedule SE) + the 50% deduction, Schedule E, Social Security taxability,
 * the full set of above-the-line adjustments (educator, HSA, IRA w/ phaseout,
 * SE-health, SEP, student loan), standard-vs-itemized (Schedule A), the
 * Qualified Dividends & Capital Gain Tax Worksheet, and the Child Tax Credit /
 * Additional CTC.
 *
 * Still pending (Phase 3): QBI deduction, EITC and the other credits, AMT, NIIT,
 * and the Additional Medicare Tax — warnings flag returns those would affect.
 */
import type { TaxReturn2024 } from "../types/taxReturn"
import type {
  AuditFlag,
  LineTrace,
  TaxCalculationResult,
  Warning,
} from "../types/result"
import { dollar, nonNeg, sumBy } from "./round"
import { computeGrossIncome } from "./pipeline/grossIncome"
import { computeScheduleC } from "./pipeline/scheduleC"
import { computeSelfEmploymentTax } from "./pipeline/scheduleSE"
import { computeCapitalGains } from "./pipeline/capitalGains"
import { computeTaxableSocialSecurity } from "./pipeline/socialSecurity"
import {
  educatorDeduction,
  hsaDeduction,
  iraDeduction,
  isAge50For2024,
  seHealthDeduction,
  studentLoanInterestDeduction,
} from "./pipeline/adjustments"
import { computeDeduction } from "./pipeline/deductionCompare"
import { computeRegularTax } from "./pipeline/regularTax"
import { computeQualifiedDivCapGainTax } from "./pipeline/qualifiedDivCapGain"
import { computeQbiDeduction } from "./pipeline/qbi"
import { computeAmt } from "./pipeline/amt"
import { computeAdditionalMedicareTax } from "./pipeline/additionalMedicare"
import { computeNiit } from "./pipeline/niit"
import { computeChildTaxCredit } from "./pipeline/childTaxCredit"
import { computeEitc } from "./pipeline/eitc"
import { computeCareCredit } from "./pipeline/careCredit"
import { computeEducationCredits } from "./pipeline/educationCredits"
import {
  computeCleanEnergyCredit,
  computeEvCredit,
  computeForeignTaxCredit,
  computeSaversCredit,
} from "./pipeline/otherCredits"
import { computePremiumTaxCredit } from "./pipeline/premiumTaxCredit"
import { computeWithholdingAndPayments } from "./pipeline/payments"
import { computeStateTax } from "./stateTaxData"
import { EARLY_WITHDRAWAL_PENALTY_2024, SALT_CAP_2024 } from "./constants/filingThresholds2024"

type Owner = "taxpayer" | "spouse"

/** Age at the end of 2024 (for the childless-EITC age test). Undefined if no DOB. */
function ageAtEndOf2024(dob: string): number | undefined {
  if (!dob) return undefined
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return undefined
  return 2024 - d.getUTCFullYear()
}

export function calculateFederalTax(r: TaxReturn2024): TaxCalculationResult {
  const warnings: Warning[] = []
  const auditFlags: AuditFlag[] = []
  const trace: LineTrace[] = []
  const line = (id: string, label: string, formRef: string, amount: number) =>
    trace.push({ id, label, formRef, amount })

  // ---- 1. Schedule C → net SE profit per owner ----
  const schedC = computeScheduleC(r)

  // ---- 2. Schedule SE → SE tax + 50% deduction (coordinated with W-2 SS wages) ----
  const w2SsWagesByOwner: Record<Owner, number> = {
    taxpayer: sumBy(
      r.income.w2.filter((w) => w.owner === "taxpayer"),
      (w) => w.box3SsWages,
    ),
    spouse: sumBy(
      r.income.w2.filter((w) => w.owner === "spouse"),
      (w) => w.box3SsWages,
    ),
  }
  const se = computeSelfEmploymentTax(schedC.netByOwner, w2SsWagesByOwner)
  const seTax = dollar(se.seTax)

  // ---- 3. Capital gains (Schedule D / 8949) ----
  const capGains = computeCapitalGains(r)

  // ---- 4. Schedule E (rental / royalty / passthrough) ----
  const scheduleENet = r.income.flags.hasRental
    ? sumBy(r.income.scheduleE, (e) => e.netIncome)
    : 0

  // ---- 5. Ordinary income components ----
  const gross = computeGrossIncome(r)

  // All income except Social Security (used by the SS worksheet and AGI).
  const otherIncomeNoSS =
    gross.ordinaryTotal + schedC.totalNet + capGains.includedInIncome + scheduleENet

  // ---- 6. Fixed (AGI-independent) above-the-line adjustments ----
  const educator = educatorDeduction(r)
  const hsa = hsaDeduction(r)
  const sep = Math.min(
    Math.max(0, r.adjustments.sepSimpleContribution),
    nonNeg(schedC.totalNet - se.deduction),
  )
  const seHealth = seHealthDeduction(r, schedC.totalNet, se.deduction, sep)
  const fixedAdjustments = educator + hsa + se.deduction + seHealth + sep

  // ---- 7. Resolve Social Security taxability ↔ IRA deduction (fixed-point loop) ----
  // Both depend on AGI (which includes taxable SS), so iterate to a stable point.
  const ssBenefits = r.income.flags.hasSocialSecurity
    ? sumBy(r.income.f1099Ssa, (s) => s.box5NetBenefits)
    : 0
  const age50 = isAge50For2024(r.taxpayer.dateOfBirth)
  let taxableSS = 0
  let ira = 0
  for (let i = 0; i < 6; i++) {
    // SS provisional income subtracts Schedule 1 lines 11–20, 23, 25 (incl. IRA,
    // excl. student loan), which here is fixedAdjustments + the current IRA estimate.
    const newSS = computeTaxableSocialSecurity({
      benefits: ssBenefits,
      otherIncome: otherIncomeNoSS,
      taxExemptInterest: gross.taxExemptInterest,
      adjustmentsForProvisional: fixedAdjustments + ira,
      status: r.filingStatus,
      livedApartFromSpouse: r.livedApartFromSpouse,
    })
    // IRA MAGI = AGI computed without the IRA (and student loan) deduction.
    const iraMagi = otherIncomeNoSS + newSS - fixedAdjustments
    const newIra = iraDeduction(
      r.adjustments.traditionalIraContribution,
      iraMagi,
      r.filingStatus,
      r.adjustments.coveredByWorkplacePlan,
      r.adjustments.spouseCoveredByWorkplacePlan,
      age50,
    )
    const converged = Math.abs(newSS - taxableSS) < 0.005 && Math.abs(newIra - ira) < 0.005
    taxableSS = newSS
    ira = newIra
    if (converged) break
  }

  // ---- 8. Student loan interest (MAGI = AGI before this deduction) ----
  const studentLoanMagi = otherIncomeNoSS + taxableSS - (fixedAdjustments + ira)
  const studentLoan = studentLoanInterestDeduction(
    r.adjustments.studentLoanInterest,
    studentLoanMagi,
    r.filingStatus,
  )

  // ---- 9. Totals → AGI ----
  const totalAdjustments = dollar(fixedAdjustments + ira + studentLoan)
  const totalIncome = dollar(otherIncomeNoSS + taxableSS)
  line("totalIncome", "Total income", "Form 1040, line 9", totalIncome)
  line("adjustments", "Adjustments to income", "Schedule 1, line 25", totalAdjustments)
  const agi = dollar(totalIncome - totalAdjustments)
  line("agi", "Adjusted gross income", "Form 1040, line 11", agi)

  // ---- 10. MAGI variants (Phase 2: approximated as AGI; refined as rules land) ----
  const magi = { niit: agi, ira: agi, studentLoan: agi, ptc: agi, ctc: agi, aotc: agi }

  // ---- 11. Deduction: standard vs itemized ----
  const wageEarnedIncome = gross.wageEarnedIncome
  const seEarnedIncome = nonNeg(schedC.totalNet - se.deduction)
  const earnedIncome = wageEarnedIncome + seEarnedIncome
  const deduction = computeDeduction(r, agi, earnedIncome)
  const deductionAmount = dollar(deduction.amount)
  line(
    "deduction",
    deduction.used === "itemized" ? "Itemized deductions" : "Standard deduction",
    deduction.used === "itemized" ? "Schedule A" : "Form 1040, line 12",
    deductionAmount,
  )

  // ---- 12. QBI deduction (§199A) ----
  const preferentialLTCG = capGains.preferentialLTCG
  const qualifiedDividends = gross.qualifiedDividends
  const netCapitalGainPreferential = qualifiedDividends + preferentialLTCG
  const taxableIncomeBeforeQbi = nonNeg(agi - deductionAmount)
  const qbiIncome = nonNeg(schedC.totalNet - se.deduction - seHealth - sep)
  const isSSTB = r.income.scheduleC.some((c) => c.isSSTB)
  const qbi = computeQbiDeduction({
    qbiIncome,
    taxableIncomeBeforeQbi,
    netCapitalGain: netCapitalGainPreferential,
    isSSTB,
    status: r.filingStatus,
  })
  const qbiDeduction = dollar(qbi.deduction)
  if (qbiDeduction > 0)
    line("qbi", "Qualified business income deduction", "Form 1040, line 13", qbiDeduction)

  // ---- 13. Taxable income ----
  const taxableIncome = nonNeg(taxableIncomeBeforeQbi - qbiDeduction)
  line("taxableIncome", "Taxable income", "Form 1040, line 15", taxableIncome)

  // ---- 14. Regular tax: Qualified Div & Cap Gain Worksheet when preferential income exists ----
  const hasPreferential = qualifiedDividends > 0 || preferentialLTCG > 0
  let regularTax: number
  let usedTaxTable = false
  let usedQualDivWorksheet = false
  let marginalRate = 0
  if (hasPreferential && taxableIncome > 0) {
    const qd = computeQualifiedDivCapGainTax(
      taxableIncome,
      qualifiedDividends,
      preferentialLTCG,
      r.filingStatus,
    )
    regularTax = qd.tax
    usedQualDivWorksheet = true
    marginalRate = computeRegularTax(taxableIncome, r.filingStatus).marginalRate
  } else {
    const reg = computeRegularTax(taxableIncome, r.filingStatus)
    regularTax = reg.tax
    usedTaxTable = reg.usedTaxTable
    marginalRate = reg.marginalRate
  }
  line("regularTax", "Tax", "Form 1040, line 16", regularTax)

  // ---- 15. AMT (Form 6251) ----
  const saltRaw =
    r.itemized.stateLocalIncomeOrSalesTax +
    r.itemized.realEstateTaxes +
    r.itemized.personalPropertyTaxes
  const saltCap = r.filingStatus === "mfs" ? SALT_CAP_2024.mfs : SALT_CAP_2024.standard
  const amtAddBacks =
    deduction.used === "itemized" ? Math.min(saltRaw, saltCap) : deductionAmount
  const amtResult = computeAmt({
    taxableIncome,
    addBacks: amtAddBacks,
    preferentialIncome: netCapitalGainPreferential,
    regularTax,
    status: r.filingStatus,
  })
  const amt = dollar(amtResult.amt)
  if (amt > 0) line("amt", "Alternative minimum tax", "Schedule 2, line 1", amt)
  const taxBeforeCredits = regularTax + amt

  // ---- 16. Nonrefundable credits (Schedule 3 first, then CTC per the 8812 limit) ----
  const nonrefundableCredits: Record<string, number> = {}
  let remainingTax = taxBeforeCredits
  const applyCredit = (key: string, label: string, formRef: string, amount: number): number => {
    const used = Math.min(dollar(amount), remainingTax)
    if (used > 0) {
      nonrefundableCredits[key] = used
      remainingTax -= used
      line(key, label, formRef, used)
    }
    return used
  }

  applyCredit("foreignTaxCredit", "Foreign tax credit", "Schedule 3, line 1", computeForeignTaxCredit(r))
  applyCredit("childDependentCare", "Child & dependent care credit", "Schedule 3, line 6f", computeCareCredit(r, agi))
  const education = computeEducationCredits(r, magi.aotc)
  applyCredit("education", "Education credits", "Schedule 3, line 3", education.nonrefundable)
  applyCredit("saversCredit", "Retirement savings (Saver's) credit", "Schedule 3, line 4", computeSaversCredit(r, agi))
  applyCredit("cleanEnergy", "Residential clean energy credit", "Schedule 3, line 5a", computeCleanEnergyCredit(r))
  applyCredit("evCredit", "Clean vehicle credit", "Schedule 3, line 6f", computeEvCredit(r, agi))

  // CTC / ODC limited to tax remaining after the Schedule 3 credits (8812 limit worksheet).
  const ctc = computeChildTaxCredit(r, magi.ctc, remainingTax, earnedIncome)
  applyCredit(
    "childTaxCredit",
    "Child Tax Credit / Credit for Other Dependents",
    "Form 1040, line 19",
    ctc.nonrefundable,
  )

  const totalNonrefundableCredits = Object.values(nonrefundableCredits).reduce((a, b) => a + b, 0)
  const taxAfterNonrefundable = nonNeg(taxBeforeCredits - totalNonrefundableCredits)

  // ---- 17. Other taxes (Schedule 2 Part II) ----
  const medicareWages = sumBy(r.income.w2, (w) => w.box5MedicareWages)
  const additionalMedicareTax = dollar(
    computeAdditionalMedicareTax(medicareWages, se.netEarnings, r.filingStatus),
  )
  const netInvestmentIncome =
    gross.taxableInterest +
    gross.ordinaryDividends +
    nonNeg(capGains.includedInIncome) +
    nonNeg(scheduleENet)
  const niit = dollar(computeNiit(netInvestmentIncome, magi.niit, r.filingStatus))
  const ptc = computePremiumTaxCredit(r)
  // 10% additional tax on early retirement distributions (Form 5329).
  const earlyCodes: readonly string[] = EARLY_WITHDRAWAL_PENALTY_2024.earlyNoExceptionCodes
  const earlyDistributions = r.income.flags.hasRetirementDistributions
    ? sumBy(
        r.income.f1099R.filter((x) => earlyCodes.includes(x.box7DistributionCode)),
        (x) => x.box2aTaxableAmount,
      )
    : 0
  const earlyWithdrawalPenalty = dollar(earlyDistributions * EARLY_WITHDRAWAL_PENALTY_2024.rate)
  const otherTaxes = dollar(
    seTax + additionalMedicareTax + niit + ptc.repayment + earlyWithdrawalPenalty,
  )
  if (seTax > 0) line("seTax", "Self-employment tax", "Schedule 2, line 4", seTax)
  if (additionalMedicareTax > 0)
    line("addlMedicare", "Additional Medicare Tax", "Schedule 2, line 11", additionalMedicareTax)
  if (niit > 0) line("niit", "Net investment income tax", "Schedule 2, line 12", niit)
  if (earlyWithdrawalPenalty > 0)
    line("earlyWithdrawal", "Additional tax on early distributions", "Schedule 2, line 8", earlyWithdrawalPenalty)
  if (ptc.repayment > 0)
    line("aptcRepayment", "Excess advance premium tax credit repayment", "Schedule 2, line 2", ptc.repayment)
  const totalTax = dollar(taxAfterNonrefundable + otherTaxes)
  line("totalTax", "Total tax", "Form 1040, line 24", totalTax)

  // ---- 18. Refundable credits ----
  const investmentIncome =
    gross.taxableInterest +
    gross.taxExemptInterest +
    gross.ordinaryDividends +
    nonNeg(capGains.includedInIncome)
  const eitcResult = computeEitc({
    r,
    earnedIncome,
    agi,
    investmentIncome,
    taxpayerAge: ageAtEndOf2024(r.taxpayer.dateOfBirth),
  })
  const eitc = eitcResult.credit
  const actc = dollar(ctc.additionalChildTaxCredit)
  const refundableCredits: Record<string, number> = {}
  if (eitc > 0) refundableCredits.earnedIncomeCredit = eitc
  if (actc > 0) refundableCredits.additionalChildTaxCredit = actc
  if (education.refundable > 0) refundableCredits.refundableAotc = education.refundable
  if (ptc.netRefundable > 0) refundableCredits.premiumTaxCredit = ptc.netRefundable
  const totalRefundableCredits = eitc + actc + education.refundable + ptc.netRefundable
  if (eitc > 0) line("eitc", "Earned income credit", "Form 1040, line 27", eitc)
  if (actc > 0) line("actc", "Additional Child Tax Credit", "Form 1040, line 28", actc)
  if (education.refundable > 0)
    line("refundableAotc", "Refundable American Opportunity credit", "Form 1040, line 29", education.refundable)

  // ---- 19. Payments + refund/owed ----
  const pay = computeWithholdingAndPayments(r)
  const totalPayments = dollar(pay.total + totalRefundableCredits)
  line("totalPayments", "Total payments", "Form 1040, line 33", totalPayments)
  const refundOrOwed = dollar(totalPayments - totalTax)
  const owes = refundOrOwed < 0
  line(
    owes ? "amountOwed" : "refund",
    owes ? "Amount you owe" : "Refund",
    owes ? "Form 1040, line 37" : "Form 1040, line 34",
    Math.abs(refundOrOwed),
  )

  // ---- 20. Rates ----
  const marginalRatePct = marginalRate * 100
  const effectiveRate = totalIncome > 0 ? (totalTax / totalIncome) * 100 : 0

  // ---- 20b. State income tax ----
  const stateWithholding =
    sumBy(r.income.w2, (w) => w.box17StateWithholding) + (r.residency.stateWithholding || 0)
  const stateResult = computeStateTax({
    code: r.residency.state,
    federalAgi: agi,
    taxableSocialSecurity: taxableSS,
    retirementDistributions: gross.retirementDistributions,
    filingStatus: r.filingStatus,
    dependents: r.dependents.length,
    stateWithholding,
    age65: (ageAtEndOf2024(r.taxpayer.dateOfBirth) ?? 0) >= 65,
  })
  if (stateResult && stateResult.hasIncomeTax && stateResult.supported)
    line("stateTax", `${stateResult.name} state income tax`, "State return", stateResult.tax)

  // ---- 21. Warnings for not-yet-modeled refinements ----
  if (qbi.wageLimitMayApply) {
    warnings.push({
      code: "QBI_WAGE_LIMIT",
      message:
        "Your taxable income is above the QBI threshold, where the W-2 wage / property (UBIA) limit can reduce the 20% deduction. We don't track business W-2 wages, so your QBI deduction may be overstated.",
    })
  }
  if (r.credits.hasMarketplaceCoverage) {
    warnings.push({
      code: "PTC_SIMPLIFIED",
      message:
        "Marketplace (ACA) premium tax credit is reconciled simply here; the income-based cap on repaying excess advance payments isn't modeled.",
    })
  }
  if (eitcResult.disqualReason) {
    warnings.push({
      code: "EITC_INELIGIBLE",
      message: `Earned Income Credit not applied: ${eitcResult.disqualReason}`,
    })
  }

  // ---- 22. Audit / data-quality flags ----
  if (r.income.flags.hasW2 && pay.withholding === 0 && gross.wages > 0) {
    auditFlags.push({
      severity: "warn",
      message:
        "You have W-2 wages but no federal tax was withheld. Double-check box 2 of your W-2(s).",
      relatedLine: "totalPayments",
    })
  }
  if (owes && totalIncome > 0 && Math.abs(refundOrOwed) > 0.1 * totalIncome) {
    auditFlags.push({
      severity: "info",
      message:
        "Your balance due is large relative to your income — consider adjusting withholding or making estimated payments next year.",
      relatedLine: "amountOwed",
    })
  }
  if (schedC.totalNet > 0 && se.deduction > 0) {
    auditFlags.push({
      severity: "info",
      message: `Self-employment tax of ${Math.round(seTax)} applies; half of it (${Math.round(
        se.deduction,
      )}) is deducted above the line.`,
      relatedLine: "seTax",
    })
  }
  // Underpayment (Form 2210) safe-harbor check — flag only (no penalty added to the bill).
  if (owes && Math.abs(refundOrOwed) >= 1_000) {
    const safeHarborCurrent = 0.9 * totalTax
    const priorYearTax = r.payments.priorYearTax
    const safeHarborPrior =
      priorYearTax !== undefined
        ? ((r.payments.priorYearAgi ?? 0) > 150_000 ? 1.1 : 1.0) * priorYearTax
        : Infinity
    const requiredAnnualPayment = Math.min(safeHarborCurrent, safeHarborPrior)
    if (pay.withholding < requiredAnnualPayment) {
      auditFlags.push({
        severity: "warn",
        message:
          "You may owe an underpayment penalty (Form 2210) — too little was paid in during the year. Consider increasing withholding or making estimated payments.",
        relatedLine: "amountOwed",
      })
    }
  }

  return {
    filingStatus: r.filingStatus,
    totalIncome,
    totalAdjustments,
    agi,
    magi,
    standardDeduction: dollar(deduction.standard),
    itemizedDeduction: dollar(deduction.itemized),
    deductionUsed: deduction.used,
    deductionAmount,
    itemizedSavings: dollar(deduction.itemizedSavings),
    qbiDeduction,
    taxableIncomeBeforeQbi,
    taxableIncome,
    regularTax,
    usedTaxTable,
    usedQualDivWorksheet,
    amt,
    additionalMedicareTax,
    niit,
    seTax,
    nonrefundableCredits,
    totalNonrefundableCredits,
    refundableCredits,
    totalRefundableCredits,
    otherTaxes,
    totalTax,
    totalPayments,
    refundOrOwed,
    owes,
    underpaymentPenalty: 0,
    marginalRate: marginalRatePct,
    effectiveRate,
    capitalLossCarryover: {
      shortTerm: dollar(capGains.carryoverShort),
      longTerm: dollar(capGains.carryoverLong),
    },
    trace,
    warnings,
    auditFlags,
    state: stateResult,
  }
}
