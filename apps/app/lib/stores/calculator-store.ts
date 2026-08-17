"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { ModelParameters } from "@/lib/calculations/financial"

/**
 * The calculator dashboard's parameter state.
 *
 * Zustand rather than context here on purpose: the control sidebar writes on
 * every slider frame, and three panels read. With context, each keystroke
 * re-renders the whole subtree including the projection table; with a store,
 * a component re-renders only if the slice it selected actually changed.
 *
 * Persisted to localStorage, like everything else the user builds in this app —
 * the model they set up should still be there tomorrow, and it never leaves the
 * device.
 */

export const CURRENCIES = ["USD", "EUR", "GBP"] as const
export type CurrencyCode = (typeof CURRENCIES)[number]

export const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
}

export const DEFAULT_PARAMETERS: ModelParameters = {
    initialPrincipal: 25000,
    monthlyContribution: 2000,
    expectedYield: 7,
    inflationRate: 2.5,
    taxBracket: 24,
    years: 20,
}

type CalculatorState = {
    parameters: ModelParameters
    currency: CurrencyCode
    setParameters: (next: Partial<ModelParameters>) => void
    setCurrency: (next: CurrencyCode) => void
    reset: () => void
}

export const useCalculatorStore = create<CalculatorState>()(
    persist(
        (set) => ({
            parameters: DEFAULT_PARAMETERS,
            currency: "USD",
            setParameters: (next) =>
                set((state) => ({ parameters: { ...state.parameters, ...next } })),
            setCurrency: (currency) => set({ currency }),
            reset: () => set({ parameters: DEFAULT_PARAMETERS }),
        }),
        {
            name: "finnacalc.calculator.model",
            // Only the model is worth keeping; nothing derived is stored, so a
            // change to the maths can't be shadowed by a stale cached result.
            partialize: (state) => ({ parameters: state.parameters, currency: state.currency }),
        }
    )
)
