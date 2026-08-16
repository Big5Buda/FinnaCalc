/**
 * Gross income aggregation — the ordinary-rate income reported directly on the
 * front of Form 1040 (lines 1–9): wages, taxable interest, ordinary dividends
 * (which include the qualified subset for income purposes), unemployment, and
 * other income. Schedule C/E/SE, capital gains, and taxable Social Security are
 * added by the orchestrator. Also surfaces qualified dividends and tax-exempt
 * interest for the tax and Social Security worksheets.
 *
 * The engine only reads a source when its interview flag is set, so hidden /
 * irrelevant income never affects the result.
 */
import type { TaxReturn2024 } from "../../types/taxReturn"
import { sumBy } from "../round"

export interface GrossIncomeResult {
  wages: number
  taxableInterest: number
  taxExemptInterest: number
  ordinaryDividends: number
  qualifiedDividends: number
  unemployment: number
  /** Taxable amount of pension/IRA/retirement distributions (1099-R box 2a). */
  retirementDistributions: number
  otherIncome: number
  /** Wages + interest + ordinary dividends + retirement + unemployment + other (no Sch C/D/E/SS). */
  ordinaryTotal: number
  /** Earned income from wages (for CTC/ACTC and the dependent standard deduction). */
  wageEarnedIncome: number
}

export function computeGrossIncome(r: TaxReturn2024): GrossIncomeResult {
  const f = r.income.flags

  const wages = f.hasW2 ? sumBy(r.income.w2, (w) => w.box1Wages) : 0
  const taxableInterest = f.hasInterest
    ? sumBy(r.income.f1099Int, (i) => i.box1Interest + i.box3UsTreasuryInterest)
    : 0
  const taxExemptInterest = f.hasInterest
    ? sumBy(r.income.f1099Int, (i) => i.box8TaxExemptInterest)
    : 0
  const ordinaryDividends = f.hasDividends
    ? sumBy(r.income.f1099Div, (d) => d.box1aOrdinaryDividends)
    : 0
  const qualifiedDividends = f.hasDividends
    ? sumBy(r.income.f1099Div, (d) => d.box1bQualifiedDividends)
    : 0
  const unemployment = f.hasUnemployment
    ? sumBy(r.income.f1099G, (g) => g.box1Unemployment)
    : 0
  const retirementDistributions = f.hasRetirementDistributions
    ? sumBy(r.income.f1099R, (x) => x.box2aTaxableAmount)
    : 0
  const otherIncome = f.hasOtherIncome ? r.income.otherIncome : 0

  const ordinaryTotal =
    wages +
    taxableInterest +
    ordinaryDividends +
    retirementDistributions +
    unemployment +
    otherIncome

  return {
    wages,
    taxableInterest,
    taxExemptInterest,
    ordinaryDividends,
    qualifiedDividends,
    unemployment,
    retirementDistributions,
    otherIncome,
    ordinaryTotal,
    wageEarnedIncome: wages,
  }
}
