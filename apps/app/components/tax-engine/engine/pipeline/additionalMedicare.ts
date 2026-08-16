/**
 * Additional Medicare Tax — 0.9% on Medicare wages + SE earnings over the
 * filing-status threshold (Form 8959). The threshold is applied to wages first,
 * then the remainder to self-employment earnings.
 */
import type { FilingStatus } from "../../types/filing"
import { ADDITIONAL_MEDICARE_2024 } from "../constants/filingThresholds2024"

export function computeAdditionalMedicareTax(
  medicareWages: number,
  seNetEarnings: number,
  status: FilingStatus,
): number {
  const threshold = ADDITIONAL_MEDICARE_2024.thresholds[status]
  const rate = ADDITIONAL_MEDICARE_2024.rate
  const onWages = Math.max(0, medicareWages - threshold) * rate
  const remainingThreshold = Math.max(0, threshold - medicareWages)
  const onSe = Math.max(0, Math.max(0, seNetEarnings) - remainingThreshold) * rate
  return onWages + onSe
}
