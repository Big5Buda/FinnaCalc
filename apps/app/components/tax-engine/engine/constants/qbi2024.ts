/**
 * Qualified Business Income deduction (§199A) — 2024 thresholds.
 * Source: Rev. Proc. 2023-34 §2.10; Forms 8995 / 8995-A.
 */
import type { FilingStatus } from "../../types/filing"

export const QBI_2024 = {
  rate: 0.2,
  /** Taxable-income threshold where the SSTB/W-2 limitations begin to phase in. */
  threshold: {
    single: 191_950,
    hoh: 191_950,
    mfs: 191_950,
    qss: 191_950,
    mfj: 383_900,
  } as Record<FilingStatus, number>,
  /** Phase-in range above the threshold (fully limited at threshold + range). */
  phaseInRange: {
    single: 50_000,
    hoh: 50_000,
    mfs: 50_000,
    qss: 50_000,
    mfj: 100_000,
  } as Record<FilingStatus, number>,
} as const
