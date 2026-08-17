"use client"

import Image from "next/image"
import Link from "next/link"
import { useMemo, useState } from "react"
import { ChevronRight, Clock, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { compactMoney, fixed, int } from "@/lib/format"
import { useBudget } from "@/components/providers/budget-provider"
import { budgetTypeTitle, type BudgetType } from "@/lib/budget/types"
import { computeFindings, findingsSummaryLine } from "@/lib/budget/findings"
import { detectSubscriptions } from "@/lib/budget/subscriptions"
import { SampleDonut } from "@/components/budget/charts"
import { Button, Notice } from "@/components/ui/primitives"
import { PageBar, PageBody, Panel } from "@/components/shell/surface"

/**
 * The Budgeting hub — a stack of feature cards, ported from
 * Features/Budgeting/BudgetingView.swift: header + Personal/Business toggle →
 * the four summary figures → My Budget, Budget Analysis, Goals, Subscriptions,
 * History.
 *
 * Every card is listed from the first visit, empty budget or not, so the page
 * advertises what it can do instead of showing a bare screen. A card's subtitle
 * describes its feature until there's real data to report, then reports it.
 */
export default function BudgetingPage() {
    const budget = useBudget()
    const [clearing, setClearing] = useState(false)

    const findings = useMemo(
        () =>
            computeFindings({
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

    const subscriptions = useMemo(
        () => detectSubscriptions(budget.currentHistory),
        [budget.currentHistory]
    )

    const hasBudget = budget.monthlyIncome > 0 || budget.monthlyExpenses > 0
    const otherType: BudgetType = budget.budgetType === "personal" ? "business" : "personal"

    const goalsSubtitle =
        budget.currentGoals.length > 0
            ? `${budget.currentGoals.length} active goal${budget.currentGoals.length === 1 ? "" : "s"}`
            : "Savings goals with progress tracking"

    const subscriptionsSubtitle =
        subscriptions.length > 0
            ? `${subscriptions.length} recurring · $${int(
                  subscriptions.reduce((sum, sub) => sum + sub.averageAmount, 0)
              )}/mo`
            : "Spot recurring charges in your transactions"

    const latestSnapshot = budget.currentHistory[0]
    const historySubtitle = latestSnapshot
        ? `${latestSnapshot.name} · saved ${latestSnapshot.endDate}`
        : "Snapshots and bank imports over time"

    return (
        <>
            <PageBar
                title="Budgeting"
                actions={
                    <div className="flex items-center gap-2">
                    <div className="flex rounded-full bg-secondary p-[3px]">
                        {(["personal", "business"] as BudgetType[]).map((type) => {
                            const selected = budget.budgetType === type
                            return (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => budget.setBudgetType(type)}
                                    className={cn(
                                        "rounded-full px-3.5 py-1.5 text-xs transition",
                                        selected
                                            ? "bg-card font-bold text-foreground shadow-sm"
                                            : "font-semibold text-muted-foreground"
                                    )}
                                >
                                    {budgetTypeTitle(type)}
                                </button>
                            )
                        })}
                    </div>
                    <button
                        type="button"
                        onClick={() => setClearing((open) => !open)}
                        aria-label="Clear data"
                        aria-expanded={clearing}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-pill text-foreground transition hover:bg-secondary"
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </button>
                    </div>
                }
            />
            <PageBody className="flex w-full max-w-4xl flex-col gap-5">
            {clearing && <ClearDataPanel onDone={() => setClearing(false)} otherType={otherType} />}

            {/* The four figures sit as dashes until there's something to report,
                so the page's shape never shifts. */}
            <Panel>
              <section className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                <Stat
                    label="INCOME"
                    value={budget.monthlyIncome > 0 ? compactMoney(budget.monthlyIncome) : "—"}
                    tone={budget.monthlyIncome > 0 ? "positive" : "muted"}
                />
                <Stat
                    label="EXPENSES"
                    value={budget.monthlyExpenses > 0 ? compactMoney(budget.monthlyExpenses) : "—"}
                    tone={budget.monthlyExpenses > 0 ? "negative" : "muted"}
                />
                {budget.budgetType === "business" ? (
                    <Stat
                        label="NET PROFIT"
                        value={budget.netProfitMargin === null ? "—" : `${fixed(budget.netProfitMargin, 0)}%`}
                        tone={budget.netProfitMargin === null ? "muted" : "brand"}
                    />
                ) : (
                    <Stat
                        label="SAVINGS RATE"
                        value={budget.savingsRate === null ? "—" : `${fixed(budget.savingsRate, 0)}%`}
                        tone={budget.savingsRate === null ? "muted" : "brand"}
                    />
                )}
                <Stat
                    label="NET INCOME"
                    value={
                        hasBudget
                            ? `${budget.monthlyNet >= 0 ? "+" : "−"}${compactMoney(Math.abs(budget.monthlyNet))}`
                            : "—"
                    }
                    tone={hasBudget ? (budget.monthlyNet >= 0 ? "positive" : "negative") : "muted"}
                />
              </section>
            </Panel>

            <div className="flex flex-col gap-3.5">
                <FeatureCard
                    href="/budgeting/budget"
                    mark={<SampleDonut size={52} />}
                    title="My Budget"
                    subtitle={
                        hasBudget
                            ? `${compactMoney(budget.monthlyIncome)} in · ${compactMoney(budget.monthlyExpenses)} out`
                            : "Add income and expenses, see where money goes"
                    }
                />
                <FeatureCard
                    href="/budgeting/analysis"
                    mark={
                        <Image
                            src="/finnabot-logo.png"
                            alt=""
                            width={52}
                            height={52}
                            className="h-[52px] w-[52px] object-contain"
                        />
                    }
                    title="Budget Analysis"
                    subtitle={findingsSummaryLine(findings) ?? "Personalized advice from your budget snapshot"}
                />
                <FeatureCard href="/budgeting/goals" mark={<Emoji>🎯</Emoji>} title="Goals" subtitle={goalsSubtitle} />
                <FeatureCard
                    href="/budgeting/subscriptions"
                    mark={<Emoji>📅</Emoji>}
                    title="Subscriptions"
                    subtitle={subscriptionsSubtitle}
                />
                <FeatureCard
                    href="/budgeting/history"
                    mark={<Clock className="h-[30px] w-[30px] text-primary" strokeWidth={1.8} />}
                    title="History"
                    subtitle={historySubtitle}
                />
            </div>
            </PageBody>
        </>
    )
}

function Stat({
    label,
    value,
    tone,
}: {
    label: string
    value: string
    tone: "positive" | "negative" | "brand" | "muted"
}) {
    return (
        <div className="flex flex-col items-center gap-0.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-muted-foreground">{label}</p>
            <p
                className={cn(
                    "figure text-2xl font-bold",
                    tone === "positive" && "text-positive",
                    tone === "negative" && "text-negative",
                    tone === "brand" && "text-primary",
                    tone === "muted" && "text-muted-foreground"
                )}
            >
                {value}
            </p>
        </div>
    )
}

function Emoji({ children }: { children: string }) {
    return (
        <span aria-hidden="true" className="flex h-[52px] w-[52px] items-center justify-center text-[32px]">
            {children}
        </span>
    )
}

function FeatureCard({
    href,
    mark,
    title,
    subtitle,
}: {
    href: string
    mark: React.ReactNode
    title: string
    subtitle: string
}) {
    return (
        <Link
            href={href}
            className="flex items-center gap-3.5 rounded-card border-[1.5px] border-border bg-card p-4 shadow-sm transition hover:border-border-strong"
        >
            {mark}
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[19px] font-medium tracking-tight text-foreground">{title}</span>
                <span className="truncate text-[12.5px] text-muted-foreground">{subtitle}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-border-strong" strokeWidth={2.5} />
        </Link>
    )
}

/**
 * Both clears stay inside the budget type on screen, and neither can be undone.
 * Each names its own reach before it runs, including the months it reaches past
 * the one open, and says what survives as well as what goes.
 */
function ClearDataPanel({ onDone, otherType }: { onDone: () => void; otherType: BudgetType }) {
    const budget = useBudget()
    const thisType = budgetTypeTitle(budget.budgetType)
    const other = budgetTypeTitle(otherType)

    function confirmItems() {
        const ok = window.confirm(
            `Clear ${thisType} budget items?\n\nEvery income and expense line in your ${thisType} budget is removed, for every month, not only the one you have open. Your ${other} budget, goals, saved history and category caps are kept. This can't be undone.`
        )
        if (ok) budget.clearBudgetItems()
        onDone()
    }

    function confirmAll() {
        const ok = window.confirm(
            `Clear everything in ${thisType}?\n\nEvery ${thisType} budget item, goal, snapshot in History and category cap is removed, for every month. Your ${other} budget is untouched. This can't be undone.`
        )
        if (ok) budget.clearAll()
        onDone()
    }

    return (
        <Notice tone="caution">
            <div className="flex flex-col gap-2">
                <p className="font-semibold">Clear data</p>
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="destructive" onClick={confirmItems}>
                        Clear budget items
                    </Button>
                    <Button size="sm" variant="destructive" onClick={confirmAll}>
                        Clear all (items, goals, history)
                    </Button>
                    <Button size="sm" variant="ghost" onClick={onDone}>
                        Cancel
                    </Button>
                </div>
            </div>
        </Notice>
    )
}
