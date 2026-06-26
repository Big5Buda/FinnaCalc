/**
 * State tax dispatcher. Applies a state's config to the federal-derived inputs
 * and returns a StateResult. States not in the supported set return a result with
 * `supported: false` (tax left at 0) so the UI can be honest rather than wrong.
 */
import type { FilingStatus, StateCode } from "../../types/filing"
import type { StateResult } from "../../types/result"
import { dollar, nonNeg } from "../round"
import { STATE_CONFIGS } from "./data2024"
import type { StateBracket, StateConfig, StateInput } from "./types"

function bracketTax(amount: number, brackets: StateBracket[]): number {
  if (amount <= 0) return 0
  let tax = 0
  for (const b of brackets) {
    if (amount > b.min) tax += (Math.min(amount, b.max) - b.min) * b.rate
  }
  return tax
}

const isMarried = (s: FilingStatus) => s === "mfj" || s === "qss"

function computeFromConfig(cfg: StateConfig, input: StateInput): StateResult {
  const base = {
    code: cfg.code,
    name: cfg.name,
    withheld: dollar(input.stateWithholding),
  }

  if (!cfg.hasIncomeTax || !cfg.brackets) {
    return {
      ...base,
      hasIncomeTax: false,
      supported: true,
      stateAgi: 0,
      taxableIncome: 0,
      tax: 0,
      refundOrOwed: dollar(input.stateWithholding),
      note: cfg.note,
    }
  }

  const persons = 1 + (isMarried(input.filingStatus) ? 1 : 0)

  let stateAgi = input.federalAgi
  if (!cfg.taxesSocialSecurity) stateAgi -= input.taxableSocialSecurity
  if (cfg.excludesRetirement) stateAgi -= input.retirementDistributions
  stateAgi = nonNeg(stateAgi)

  const standardDeduction = cfg.standardDeduction ? cfg.standardDeduction[input.filingStatus] : 0
  const exemptions =
    (cfg.personalExemption ?? 0) * persons + (cfg.dependentExemption ?? 0) * input.dependents
  const taxableIncome = nonNeg(stateAgi - standardDeduction - exemptions)

  let tax = bracketTax(taxableIncome, cfg.brackets[input.filingStatus])
  // Exemption credits (e.g. California) reduce tax directly.
  const credits =
    (cfg.exemptionCredit ?? 0) * persons + (cfg.dependentExemptionCredit ?? 0) * input.dependents
  tax = nonNeg(dollar(tax) - credits)

  return {
    ...base,
    hasIncomeTax: true,
    supported: true,
    stateAgi: dollar(stateAgi),
    taxableIncome: dollar(taxableIncome),
    tax: dollar(tax),
    refundOrOwed: dollar(input.stateWithholding - tax),
    note: cfg.note,
  }
}

/** Compute the state result, or undefined when no state of residence is set. */
export function computeStateTax(input: StateInput): StateResult | undefined {
  if (!input.code) return undefined
  const cfg = STATE_CONFIGS[input.code]
  if (!cfg) {
    return {
      code: input.code,
      name: input.code,
      hasIncomeTax: true,
      supported: false,
      stateAgi: 0,
      taxableIncome: 0,
      tax: 0,
      withheld: dollar(input.stateWithholding),
      refundOrOwed: dollar(input.stateWithholding),
      note: "State tax for this state isn't estimated yet.",
    }
  }
  return computeFromConfig(cfg, input)
}

/** The set of state codes the engine has data for (the supported dropdown). */
export const SUPPORTED_STATES: { code: StateCode; name: string; hasIncomeTax: boolean }[] =
  Object.values(STATE_CONFIGS).map((c) => ({ code: c.code, name: c.name, hasIncomeTax: c.hasIncomeTax }))
