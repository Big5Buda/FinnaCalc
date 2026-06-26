/** Public surface of the pure calculation engine. */
export { calculateFederalTax } from "./calculator"
export { bracketTax, marginalRate, computeRegularTax } from "./pipeline/regularTax"
export {
  computeStandardDeduction,
  computeItemizedDeduction,
  computeDeduction,
  isConsidered65For2024,
} from "./pipeline/deductionCompare"
export { computeChildTaxCredit } from "./pipeline/childTaxCredit"
export {
  educatorDeduction,
  hsaDeduction,
  iraDeduction,
  seHealthDeduction,
  studentLoanInterestDeduction,
} from "./pipeline/adjustments"
export { computeScheduleC } from "./pipeline/scheduleC"
export { computeSelfEmploymentTax } from "./pipeline/scheduleSE"
export { computeCapitalGains } from "./pipeline/capitalGains"
export {
  computeQualifiedDivCapGainTax,
  preferentialStackTax,
} from "./pipeline/qualifiedDivCapGain"
export { computeTaxableSocialSecurity } from "./pipeline/socialSecurity"
export { computeQbiDeduction } from "./pipeline/qbi"
export { computeAmt } from "./pipeline/amt"
export { computeAdditionalMedicareTax } from "./pipeline/additionalMedicare"
export { computeNiit } from "./pipeline/niit"
export { computeEitc } from "./pipeline/eitc"
export { computeCareCredit } from "./pipeline/careCredit"
export { computeEducationCredits } from "./pipeline/educationCredits"
export {
  computeSaversCredit,
  computeCleanEnergyCredit,
  computeEvCredit,
  computeForeignTaxCredit,
} from "./pipeline/otherCredits"
export { computePremiumTaxCredit } from "./pipeline/premiumTaxCredit"
export { computeStateTax, SUPPORTED_STATES } from "./stateTaxData"
export * from "./constants"
