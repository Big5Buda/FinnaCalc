/**
 * Recurring-charge detection, ported from the SubscriptionDetector in
 * Features/Budgeting/SubscriptionsView.swift. Pure client-side analysis of
 * transactions already imported into history — no new data source, no backend
 * call.
 *
 * This is detection, not cancellation.
 */

import type { BudgetHistoryEntry, ChargeCadence } from "@/lib/budget/types"

export type DetectedSubscription = {
    /** Normalized merchant key. */
    id: string
    /** Display name, as imported. */
    merchant: string
    averageAmount: number
    occurrences: number
    lastDate: Date
    /**
     * The cycle the gaps actually fit. Everything used to be reported monthly
     * because monthly was the only gap looked for; saying "Monthly" under a
     * weekly charge would be a plain untruth.
     */
    cadence: ChargeCadence
    category: string
}

/** The gaps that count as a repeating charge, in days, with a real biller's slack. */
const CADENCE_WINDOWS: { low: number; high: number; cadence: ChargeCadence }[] = [
    { low: 6, high: 8, cadence: "weekly" },
    { low: 12, high: 16, cadence: "biweekly" },
    { low: 20, high: 40, cadence: "monthly" },
    { low: 80, high: 100, cadence: "quarterly" },
    { low: 350, high: 380, cadence: "annually" },
]

/**
 * Categories that repeat every month and are nobody's idea of a subscription.
 * Rent and the power bill would otherwise top the list and bury the things a
 * user might actually cancel.
 */
const NOT_SUBSCRIPTIONS = new Set([
    "Housing",
    "Utilities",
    "Debt Payments",
    "Insurance",
    "Savings",
    "Retirement",
    "Rent/Lease",
    "Loan Payments",
    "Salaries/Wages",
    "Taxes",
])

/** Plaid's own primaries for the same "repeats but isn't a subscription" set. */
const PLAID_NOT_SUBSCRIPTIONS = new Set([
    "RENT_AND_UTILITIES",
    "LOAN_PAYMENTS",
    "TRANSFER_OUT",
    "TRANSFER_IN",
    "BANK_FEES",
    "INCOME",
])

type Charge = { date: string; name: string; amount: number; category: string }

function normalize(name: string): string {
    return name.trim().toLowerCase()
}

function parseISO(raw: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.slice(0, 10))
    if (!match) return null
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/**
 * Flags a merchant as recurring when at least two charges land a plausible
 * billing cycle apart with amounts within 25% of each other. Deliberately
 * conservative — a missed subscription is far less annoying than a false one.
 */
export function detectSubscriptions(history: BudgetHistoryEntry[]): DetectedSubscription[] {
    const charges: Charge[] = history
        .flatMap((entry) => entry.budgetItems)
        .filter((item) => item.type === "expense" && item.importDate)
        .map((item) => ({
            date: item.importDate as string,
            name: item.subcategory,
            amount: item.amount,
            category: item.category,
        }))

    if (charges.length === 0) return []

    const grouped = new Map<string, Charge[]>()
    for (const charge of charges) {
        const key = normalize(charge.name)
        if (!key) continue
        grouped.set(key, [...(grouped.get(key) ?? []), charge])
    }

    const results: DetectedSubscription[] = []
    for (const [key, group] of grouped) {
        const category = group[0]?.category ?? ""
        if (NOT_SUBSCRIPTIONS.has(category) || PLAID_NOT_SUBSCRIPTIONS.has(category.toUpperCase())) continue

        const dated = group
            .map((charge) => {
                const date = parseISO(charge.date)
                return date ? { date, amount: charge.amount } : null
            })
            .filter((entry): entry is { date: Date; amount: number } => entry !== null)
            .sort((a, b) => a.date.getTime() - b.date.getTime())
        if (dated.length < 2) continue

        const amounts = dated.map((entry) => entry.amount)
        const average = amounts.reduce((sum, value) => sum + value, 0) / amounts.length
        if (!(average > 0)) continue
        if (!amounts.every((value) => Math.abs(value - average) / average < 0.25)) continue

        // The cycle the most recent gap fits — a biller that changed cadence
        // should be reported on what it does now.
        let cadence: ChargeCadence | null = null
        for (let i = dated.length - 1; i > 0; i--) {
            const days = (dated[i].date.getTime() - dated[i - 1].date.getTime()) / 86_400_000
            const window = CADENCE_WINDOWS.find((w) => days >= w.low && days <= w.high)
            if (window) {
                cadence = window.cadence
                break
            }
        }
        if (!cadence) continue

        results.push({
            id: key,
            merchant: group[0]?.name ?? key,
            averageAmount: average,
            occurrences: dated.length,
            lastDate: dated[dated.length - 1].date,
            cadence,
            category,
        })
    }

    return results.sort((a, b) => b.averageAmount - a.averageAmount)
}
