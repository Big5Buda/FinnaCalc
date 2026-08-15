"use client"

import type { ReactNode } from "react"
import * as Icons from "lucide-react"
import { cn } from "@/lib/utils"
import type { CalcAccent, CalcResults } from "@/lib/calculators/math"
import type { CalculatorEntry } from "@/lib/calculators/catalog"
import { Button } from "@/components/ui/primitives"

/**
 * The standard calculator page — header, section cards, the results panel (or
 * the reason there isn't one), and the Calculate button. Ported from
 * CalcSupport.swift's `CalculatorScreen`; results reveal on the first
 * Calculate, then stay live as the inputs change.
 */

const ACCENT_CLASS: Record<CalcAccent, string> = {
    green: "text-positive",
    blue: "text-primary",
    red: "text-negative",
    purple: "text-accent-purple",
    orange: "text-accent-orange",
}

export function CalculatorHeader({ entry }: { entry: CalculatorEntry }) {
    const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[entry.icon] ?? Icons.Calculator
    return (
        <header className="flex items-start gap-3 pt-1.5">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-primary/14 text-primary">
                <Icon className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div className="flex flex-col gap-1.5">
                <h1 className="text-xl font-semibold text-foreground">{entry.title}</h1>
                <p className="text-sm text-muted-foreground">{entry.summary}</p>
            </div>
        </header>
    )
}

export function ResultsPanel({ verb, results }: { verb: string; results: NonNullable<CalcResults> }) {
    return (
        <section className="overflow-hidden rounded-md border-l-4 border-primary bg-primary-soft p-6">
            <h2 className="mb-4 text-lg font-semibold text-primary">Your {verb} Calculation</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {results.map((metric) => (
                    <div key={metric.label} className="flex flex-col gap-0.5">
                        <p className="text-sm text-muted-foreground">{metric.label}</p>
                        <p className={cn("figure text-2xl font-bold", ACCENT_CLASS[metric.accent])}>
                            {metric.value}
                        </p>
                    </div>
                ))}
            </div>
        </section>
    )
}

/** Shown instead of results when the inputs can't be computed. */
export function ResultsError({ message }: { message: string }) {
    return (
        <p className="rounded-lg border border-border border-l-4 border-l-negative bg-card p-4 text-sm text-negative">
            {message}
        </p>
    )
}

export function CalculatorScreen({
    entry,
    verb,
    revealed,
    onCalculate,
    results,
    invalidMessage = "Enter valid values to see results.",
    children,
}: {
    entry: CalculatorEntry
    verb: string
    revealed: boolean
    onCalculate: () => void
    results: CalcResults
    invalidMessage?: string
    children: ReactNode
}) {
    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-6">
            <CalculatorHeader entry={entry} />
            {children}
            {revealed &&
                (results ? (
                    <ResultsPanel verb={verb} results={results} />
                ) : (
                    <ResultsError message={invalidMessage} />
                ))}
            <div className="sticky bottom-0 -mx-4 mt-2 border-t border-border bg-background px-4 pb-4 pt-3">
                <Button size="lg" className="w-full" onClick={onCalculate}>
                    Calculate {verb}
                </Button>
            </div>
        </div>
    )
}
