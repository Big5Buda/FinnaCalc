"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { fixed, int } from "@/lib/format"
import { ApiError, apiPost, postTextStream } from "@/lib/api-client"
import { useBudget } from "@/components/providers/budget-provider"
import { measureGoal } from "@/lib/budget/goals"
import {
    categoryMoves,
    computeFindings,
    emergencyMonths,
    findingsScore,
    findingsSummaryLine,
    type Finding,
    type FindingsInput,
} from "@/lib/budget/findings"
import { monthlyAmount } from "@/lib/budget/types"
import { Button, Notice, SectionLabel } from "@/components/ui/primitives"

/**
 * Budget Analysis — the local findings (deterministic, computed here, no model)
 * plus the AI report that /api/budget-advisor streams. Ported from
 * Features/Budgeting/BudgetAdvisorView.swift, including its snapshot shape, so
 * the model sees exactly what the app sends it.
 */

/** JS Math.round, matching the app's jsRound. */
const round = (value: number) => Math.round(value)

export default function BudgetAnalysisPage() {
    const budget = useBudget()
    const [depth, setDepth] = useState<"quick" | "deep">("quick")
    const [report, setReport] = useState("")
    const [running, setRunning] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [fixes, setFixes] = useState<Record<string, string>>({})

    const input = useMemo<FindingsInput>(
        () => ({
            budgetType: budget.budgetType,
            items: budget.currentItems,
            goals: budget.currentGoals,
            allItems: budget.items,
            slot: budget.slot,
            monthlyIncome: budget.monthlyIncome,
            monthlyExpenses: budget.monthlyExpenses,
            monthlyNet: budget.monthlyNet,
            expenseByCategory: budget.expenseByCategory,
        }),
        [budget]
    )

    const findings = useMemo(() => computeFindings(input), [input])
    const score = findingsScore(findings)
    const hasData = budget.monthlyIncome > 0 || budget.monthlyExpenses > 0

    /** The payload the app sends, field for field. */
    const snapshot = useMemo(() => {
        const income = budget.monthlyIncome
        const goals = budget.currentGoals.map((goal) => {
            const measured = measureGoal(goal, budget.currentItems).current
            return {
                name: goal.name,
                target: goal.targetAmount,
                saved: measured,
                monthlyContribution: goal.monthlyContribution,
                targetDate: goal.targetDate,
                pctComplete: goal.targetAmount > 0 ? round((measured / goal.targetAmount) * 100) : 0,
            }
        })
        return {
            budgetType: budget.budgetType,
            monthlyIncome: round(income),
            monthlyExpenses: round(budget.monthlyExpenses),
            monthlyNet: round(budget.monthlyNet),
            savingsRatePct: round((budget.savingsRate ?? 0) * 10) / 10,
            expenseByCategory: budget.expenseByCategory.map((slice) => ({
                category: slice.name,
                amount: round(slice.value),
                pctOfIncome: income > 0 ? round((slice.value / income) * 1000) / 10 : null,
            })),
            incomeByCategory: budget.incomeByCategory.map((slice) => ({
                source: slice.name,
                amount: round(slice.value),
            })),
            savingsGoals: goals,
            totalSavedAcrossGoals: round(goals.reduce((sum, goal) => sum + goal.saved, 0)),
            emergencyFundMonthsCovered: round((emergencyMonths(input) ?? 0) * 10) / 10,
            categoryChanges: categoryMoves(input)
                .slice(0, 3)
                .map((move) => ({
                    category: move.category,
                    currentPerMonth: round(move.current),
                    previousPerMonth: round(move.previous),
                    pctChange: round(move.change * 10) / 10,
                    comparedTo: `${move.currentLabel} vs ${move.previousLabel}`,
                })),
            lineItems: [...budget.currentItems]
                .sort((a, b) => monthlyAmount(b) - monthlyAmount(a))
                .slice(0, 40)
                .map((item) => ({
                    name: item.subcategory,
                    category: item.category,
                    type: item.type,
                    perMonth: round(monthlyAmount(item)),
                })),
            dataNotes: [
                "Figures come from the budget the user has open in My Budget; amounts are normalized to a monthly rate.",
                "Goal balances are what the user recorded by hand; we cannot see account balances.",
                emergencyMonths(input) === null
                    ? "No goal is labeled as an emergency fund, so months covered is unknown rather than zero."
                    : "Emergency-fund months come from goals the user labeled as such.",
            ],
        }
    }, [budget, input])

    async function runReport() {
        setRunning(true)
        setError(null)
        setReport("")
        try {
            await postTextStream(
                "/api/budget-advisor",
                { snapshot, depth, messages: [] },
                (text) => setReport(text)
            )
        } catch (err) {
            setError(
                err instanceof ApiError && err.notConfigured
                    ? "Budget analysis isn't configured on this deployment yet."
                    : err instanceof Error
                      ? err.message
                      : "Couldn't run the analysis."
            )
        }
        setRunning(false)
    }

    async function loadFixes() {
        try {
            const { fixes: rows } = await apiPost<{ fixes: { id: string; fix: string }[] }>(
                "/api/budget-advisor",
                {
                    snapshot,
                    findings: findings.map((finding) => ({
                        id: finding.id,
                        title: finding.title,
                        detail: finding.detail,
                        status: finding.tone,
                    })),
                }
            )
            setFixes(Object.fromEntries(rows.map((row) => [row.id, row.fix])))
        } catch {
            // The deterministic fix copy is already on screen; an AI rewrite
            // failing is not worth an error banner.
        }
    }

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-6">
            <header className="flex flex-col gap-1">
                <Link href="/budgeting" className="text-sm font-semibold text-primary">
                    ← Budgeting
                </Link>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Budget Analysis</h1>
                <p className="text-sm text-muted-foreground">
                    {findingsSummaryLine(findings) ?? "Add income and expenses to get an analysis."}
                </p>
            </header>

            {!hasData ? (
                <Notice tone="info">
                    There&rsquo;s no budget to analyse yet.{" "}
                    <Link href="/budgeting/budget" className="font-semibold text-primary">
                        Open My Budget
                    </Link>{" "}
                    and add what comes in and goes out.
                </Notice>
            ) : (
                <>
                    <section className="flex items-center gap-4 rounded-card border-[1.5px] border-border bg-card p-4">
                        <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border-4 border-primary/20">
                            <span className="figure text-xl font-bold text-foreground">{score}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <p className="text-sm font-semibold text-foreground">Budget score</p>
                            <p className="text-xs text-muted-foreground">
                                Weighted over surplus, savings rate, emergency cover and goal pace. Informational
                                findings carry no weight.
                            </p>
                        </div>
                    </section>

                    <section className="flex flex-col gap-2.5">
                        <SectionLabel>Findings</SectionLabel>
                        {findings.map((finding) => (
                            <FindingRow key={finding.id} finding={finding} aiFix={fixes[finding.id]} />
                        ))}
                    </section>

                    <section className="flex flex-col gap-3 rounded-card border-[1.5px] border-border bg-card p-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex rounded-full bg-secondary p-[3px]">
                                {(["quick", "deep"] as const).map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => setDepth(option)}
                                        className={cn(
                                            "rounded-full px-3.5 py-1.5 text-xs transition",
                                            depth === option
                                                ? "bg-card font-bold text-foreground shadow-sm"
                                                : "font-semibold text-muted-foreground"
                                        )}
                                    >
                                        {option === "quick" ? "Quick read" : "Deep dive"}
                                    </button>
                                ))}
                            </div>
                            <Button onClick={runReport} disabled={running}>
                                {running ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Sparkles className="h-4 w-4" />
                                )}
                                {report ? "Run again" : "Analyse my budget"}
                            </Button>
                            {findings.length > 0 && (
                                <Button variant="ghost" onClick={loadFixes} disabled={running}>
                                    Rewrite the fixes with AI
                                </Button>
                            )}
                        </div>

                        {error && <Notice tone="error">{error}</Notice>}

                        {report && (
                            <div className="prose-sm flex flex-col gap-2 text-sm leading-relaxed text-body">
                                {report.split("\n").map((line, index) => (
                                    <ReportLine key={index} line={line} />
                                ))}
                            </div>
                        )}

                        <p className="text-[11px] text-muted-foreground">
                            The analysis is generated by an AI model from the numbers above. It can be wrong,
                            and it isn&rsquo;t financial advice.
                        </p>
                    </section>
                </>
            )}
        </div>
    )
}

function FindingRow({ finding, aiFix }: { finding: Finding; aiFix?: string }) {
    return (
        <article className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-2">
                <p className="flex-1 text-sm font-semibold text-foreground">{finding.title}</p>
                <span
                    className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                        finding.tone === "good" && "bg-positive/14 text-positive",
                        finding.tone === "warn" && "bg-caution/16 text-foreground",
                        finding.tone === "bad" && "bg-negative/12 text-negative"
                    )}
                >
                    {finding.label}
                </span>
            </div>
            <p className="figure text-xs font-normal text-muted-foreground">{finding.detail}</p>
            <p className="text-[13px] text-body">{aiFix ?? finding.fix}</p>
            {finding.action && (
                <Link
                    href={finding.action === "openGoals" ? "/budgeting/goals" : "/budgeting/budget"}
                    className="text-xs font-semibold text-primary"
                >
                    {finding.action === "openGoals" ? "Open Goals" : "Open My Budget"} →
                </Link>
            )}
        </article>
    )
}

/** Minimal markdown: headings and bullets, with **bold** inline. */
function ReportLine({ line }: { line: string }) {
    if (line.trim() === "") return <span className="h-1" />
    const heading = /^#{1,6}\s*(.+)$/.exec(line)
    const bullet = /^\s*[-*]\s+(.+)$/.exec(line)
    const text = heading?.[1] ?? bullet?.[1] ?? line
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
            return (
                <strong key={index} className="text-foreground">
                    {part.slice(2, -2)}
                </strong>
            )
        }
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
            return <em key={index}>{part.slice(1, -1)}</em>
        }
        return <span key={index}>{part}</span>
    })

    if (heading) return <p className="pt-2 text-base font-bold text-foreground">{parts}</p>
    if (bullet) return <p className="pl-3">• {parts}</p>
    return <p>{parts}</p>
}
