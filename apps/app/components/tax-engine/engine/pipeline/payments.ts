/**
 * Total federal payments (Form 1040 lines 25–26) — withholding from all forms
 * plus estimated payments. Refundable credits (EITC/ACTC/etc.) are added by the
 * orchestrator into total payments per the 1040 ordering.
 */
import type { TaxReturn2024 } from "../../types/taxReturn"
import { sumBy } from "../round"

export interface PaymentsResult {
  withholding: number
  estimatedPayments: number
  /** Withholding + estimated (excludes refundable credits). */
  total: number
}

export function computeWithholdingAndPayments(r: TaxReturn2024): PaymentsResult {
  const f = r.income.flags
  const w2Withholding = f.hasW2 ? sumBy(r.income.w2, (w) => w.box2FederalWithholding) : 0
  const intWithholding = f.hasInterest
    ? sumBy(r.income.f1099Int, (i) => i.box4FederalWithholding)
    : 0
  const divWithholding = f.hasDividends
    ? sumBy(r.income.f1099Div, (d) => d.box4FederalWithholding)
    : 0
  const retirementWithholding = f.hasRetirementDistributions
    ? sumBy(r.income.f1099R, (x) => x.box4FederalWithholding)
    : 0
  const unemploymentWithholding = f.hasUnemployment
    ? sumBy(r.income.f1099G, (g) => g.box4FederalWithholding)
    : 0
  const ssaWithholding = f.hasSocialSecurity
    ? sumBy(r.income.f1099Ssa, (s) => s.federalWithholding)
    : 0

  const withholding =
    w2Withholding +
    intWithholding +
    divWithholding +
    retirementWithholding +
    unemploymentWithholding +
    ssaWithholding +
    r.payments.additionalWithholding

  const estimatedPayments = r.payments.estimatedPayments
  return { withholding, estimatedPayments, total: withholding + estimatedPayments }
}
