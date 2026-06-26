"use client"

import { useMemo } from "react"
import { calculateFederalTax } from "../engine/calculator"
import type { TaxReturn2024 } from "../types/taxReturn"
import type { TaxCalculationResult } from "../types/result"

/**
 * Memoized live calculation. Recomputes whenever the return object reference
 * changes. (Phase 4 adds input debouncing once the full interview has many
 * keystroke-level fields; for now the calc is pure and instant.)
 */
export function useLiveCalculation(taxReturn: TaxReturn2024): TaxCalculationResult {
  return useMemo(() => calculateFederalTax(taxReturn), [taxReturn])
}
