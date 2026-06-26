/**
 * Alternative Minimum Tax — 2024 (Form 6251).
 * Source: Rev. Proc. 2023-34 §2.11; IRC §55.
 */
import type { FilingStatus } from "../../types/filing"

export const AMT_2024 = {
  exemption: {
    single: 85_700,
    hoh: 85_700,
    mfj: 133_300,
    qss: 133_300,
    mfs: 66_650,
  } as Record<FilingStatus, number>,
  /** Exemption phases out at 25¢ per $1 of AMTI over this threshold. */
  exemptionPhaseoutThreshold: {
    single: 609_350,
    hoh: 609_350,
    mfs: 609_350,
    mfj: 1_218_700,
    qss: 1_218_700,
  } as Record<FilingStatus, number>,
  exemptionPhaseoutRate: 0.25,
  /** AMT is 26% up to this AMT base, 28% above (halved for MFS). */
  rate28Threshold: 232_600,
  rate28ThresholdMfs: 116_300,
  lowRate: 0.26,
  highRate: 0.28,
} as const
