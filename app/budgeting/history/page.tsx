"use client"

import Link from "next/link"
import { useState } from "react"
import { Download, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { compactMoney, currency } from "@/lib/format"
import { useBudget } from "@/components/providers/budget-provider"
import type { BudgetHistoryEntry } from "@/lib/budget/types"
import { Button, Notice, SectionLabel } from "@/components/ui/primitives"

/**
 * History — saved snapshots and bank imports, newest first. Ported from
 * Features/Budgeting/HistoryTabView.swift: a snapshot is a frozen copy of a
 * budget, and importing one brings its lines back into the working budget
 * (re-categorised where the saved category doesn't fit this budget).
 */
export default function HistoryPage() {
    const budget = useBudget()
    const [notice, setNotice] = useState<string | null>(null)

    function importEntry(entry: BudgetHistoryEntry) {
        const lines = budget.itemsFromSnapshot(entry)
        const combine =
            budget.currentItems.length > 0 &&
            window.confirm(
                `Add ${lines.length} lines from "${entry.name}" to the budget you have open?\n\nOK adds them alongside what's there. Cancel replaces the working budget with this snapshot.`
            )
        budget.landImport(lines, combine)
        setNotice(`Imported ${lines.length} lines from "${entry.name}" into the working budget.`)
    }

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-6">
            <header className="flex flex-col gap-1">
                <Link href="/budgeting" className="text-sm font-semibold text-primary">
                    ← Budgeting
                </Link>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">History</h1>
                <p className="text-sm text-muted-foreground">
                    Snapshots you saved, and anything imported from a bank. Nothing here changes on its own.
                </p>
            </header>

            {notice && <Notice tone="info">{notice}</Notice>}

            {budget.currentHistory.length === 0 ? (
                <Notice tone="info">
                    No snapshots yet. Save one from{" "}
                    <Link href="/budgeting/budget" className="font-semibold text-primary">
                        My Budget
                    </Link>
                    , or connect a bank there to import transactions.
                </Notice>
            ) : (
                <section className="flex flex-col gap-2.5">
                    <SectionLabel>Saved</SectionLabel>
                    {budget.currentHistory.map((entry) => (
                        <article
                            key={entry.id}
                            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex min-w-0 flex-1 flex-col">
                                    <p className="truncate text-sm font-semibold text-foreground">
                                        {entry.name}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {entry.startDate || "—"} → {entry.endDate || "—"} ·{" "}
                                        {entry.budgetItems.length} lines
                                    </p>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => importEntry(entry)}
                                        aria-label={`Import ${entry.name}`}
                                        className="text-xs font-semibold text-primary"
                                    >
                                        <Download className="mr-1 inline h-3.5 w-3.5" />
                                        Import
                                    </button>
                                    <button
                                        type="button"
                                        aria-label={`Delete ${entry.name}`}
                                        onClick={() => {
                                            if (
                                                window.confirm(
                                                    `Delete the snapshot "${entry.name}"? Your live budget is untouched. This can't be undone.`
                                                )
                                            ) {
                                                budget.deleteSnapshot(entry.id)
                                            }
                                        }}
                                    >
                                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground transition hover:text-destructive" />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
                                <Figure label="In" value={compactMoney(entry.monthlyIncome)} tone="positive" />
                                <Figure
                                    label="Out"
                                    value={compactMoney(entry.monthlyExpenses)}
                                    tone="negative"
                                />
                                <Figure
                                    label="Net"
                                    value={`${entry.monthlyNet >= 0 ? "+" : "−"}${compactMoney(
                                        Math.abs(entry.monthlyNet)
                                    )}`}
                                    tone={entry.monthlyNet >= 0 ? "positive" : "negative"}
                                />
                            </div>

                            <details className="text-xs text-muted-foreground">
                                <summary className="cursor-pointer font-semibold text-foreground">
                                    Show lines
                                </summary>
                                <ul className="mt-2 flex flex-col gap-1">
                                    {entry.budgetItems.slice(0, 50).map((line) => (
                                        <li key={line.id} className="flex justify-between gap-3">
                                            <span className="truncate">
                                                {line.subcategory || line.category}
                                                {line.importDate ? ` · ${line.importDate}` : ""}
                                            </span>
                                            <span
                                                className={cn(
                                                    "figure shrink-0",
                                                    line.type === "income" ? "text-positive" : "text-negative"
                                                )}
                                            >
                                                {line.type === "income" ? "+" : "−"}
                                                {currency(line.amount, 2)}
                                            </span>
                                        </li>
                                    ))}
                                    {entry.budgetItems.length > 50 && (
                                        <li className="pt-1">
                                            + {entry.budgetItems.length - 50} more in this snapshot
                                        </li>
                                    )}
                                </ul>
                            </details>
                        </article>
                    ))}
                </section>
            )}

            <Button variant="outline" onClick={() => window.print()} className="self-start">
                Print this page
            </Button>
        </div>
    )
}

function Figure({ label, value, tone }: { label: string; value: string; tone: "positive" | "negative" }) {
    return (
        <div className="flex flex-col items-center">
            <span className="text-[11px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                {label}
            </span>
            <span
                className={cn("figure text-base font-bold", tone === "positive" ? "text-positive" : "text-negative")}
            >
                {value}
            </span>
        </div>
    )
}
