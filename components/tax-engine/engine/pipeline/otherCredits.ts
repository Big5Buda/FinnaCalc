/**
 * Smaller nonrefundable credits: Saver's Credit (8880), Residential Clean Energy
 * (5695), Clean Vehicle (8936), and Foreign Tax Credit (1116, simplified to the
 * direct credit). Each is limited to remaining tax by the orchestrator.
 */
import type { TaxReturn2024 } from "../../types/taxReturn"
import {
  CLEAN_ENERGY_2024,
  EV_CREDIT_2024,
  SAVERS_CREDIT_2024,
} from "../constants/credits2024"
import { dollar } from "../round"

/** Retirement Savings Contributions Credit (Form 8880). */
export function computeSaversCredit(r: TaxReturn2024, agi: number): number {
  if (r.credits.isFullTimeStudent || r.taxpayer.claimedAsDependentByAnother) return 0
  const contribution = Math.max(0, r.credits.retirementContributions)
  if (contribution <= 0) return 0

  const perPersonCap = SAVERS_CREDIT_2024.contributionCap
  const cap = r.filingStatus === "mfj" ? perPersonCap * 2 : perPersonCap
  const eligible = Math.min(contribution, cap)

  let rate = 0
  for (const tier of SAVERS_CREDIT_2024.tiers[r.filingStatus]) {
    if (agi <= tier.agiCeiling) {
      rate = tier.rate
      break
    }
  }
  return dollar(eligible * rate)
}

/** Residential Clean Energy Credit (Form 5695) — 30% of qualified property cost. */
export function computeCleanEnergyCredit(r: TaxReturn2024): number {
  return dollar(Math.max(0, r.credits.cleanEnergyCost) * CLEAN_ENERGY_2024.rate)
}

/** New Clean Vehicle Credit (Form 8936) — up to $7,500, subject to MAGI caps. */
export function computeEvCredit(r: TaxReturn2024, magi: number): number {
  if (magi > EV_CREDIT_2024.magiCap[r.filingStatus]) return 0
  return Math.min(Math.max(0, r.credits.evCreditAmount), EV_CREDIT_2024.max)
}

/** Foreign Tax Credit (Form 1116) — simplified to the foreign tax paid. */
export function computeForeignTaxCredit(r: TaxReturn2024): number {
  return Math.max(0, r.credits.foreignTaxPaid)
}
