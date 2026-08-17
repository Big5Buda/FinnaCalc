"use client"

import { useMemo, type ReactNode } from "react"
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    type TooltipProps,
} from "recharts"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { useBudget } from "@/components/providers/budget-provider"
import {
    inflationCost,
    monthlyBurn,
    netBalance,
    project,
    realAnnualReturn,
    runwayMonths,
    savingsRate,
    spendingVelocity,
} from "@/lib/calculations/financial"
import { compact, money, pct } from "@/lib/calculations/money"
import { CURRENCY_SYMBOL, useCalculatorStore } from "@/lib/stores/calculator-store"
import { cn } from "@/lib/utils"

/**
 * The centre column: what the model produces, and how the model compares to
 * what's actually happening in the user's budget.
 *
 * Those are two different kinds of number and they are kept visually apart —
 * modelled figures sit above the rule, measured ones below it, each group
 * labelled. Mixing a projection with a bank-derived figure in one undifferen-
 * tiated grid is how a dashboard starts lying: the reader can no longer tell
 * which numbers are assumptions.
 *
 * When there's no budget yet, the measured row says so rather than rendering
 * zeroes.
 */

export function AnalyticsCenter() {
    const parameters = useCalculatorStore((state) => state.parameters)
    const currencyCode = useCalculatorStore((state) => state.currency)
    const symbol = CURRENCY_SYMBOL[currencyCode]

    const budget = useBudget()

    const series = useMemo(() => project(parameters), [parameters])
    const final = series[series.length - 1]

    const hasBudget = budget.ready && (budget.monthlyIncome > 0 || budget.monthlyExpenses > 0)
    const burn = monthlyBurn(budget.monthlyExpenses)
    const runway = hasBudget ? runwayMonths(final?.realBalance ?? 0, burn) : null

    return (
        <div className="flex flex-col gap-6">
            {/* ── Modelled ──────────────────────────────────────────────── */}
            <section className="flex flex-col gap-3">
                <SectionHeading
                    title="Modelled"
                    detail={`Your assumptions, compounded over ${parameters.years} years.`}
                />
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                    <Kpi
                        label="Projected balance"
                        value={compact(final?.balance, symbol)}
                        note="Nominal, before inflation"
                    />
                    <Kpi
                        label="In today's money"
                        value={compact(final?.realBalance, symbol)}
                        note={`After ${pct(parameters.inflationRate)} inflation`}
                        trend="down"
                    />
                    <Kpi
                        label="Lost to inflation"
                        value={final ? compact(inflationCost(final), symbol) : "—"}
                        note="Nominal minus real"
                        trend="down"
                    />
                    <Kpi
                        label="Compounding added"
                        value={compact(final?.growth, symbol)}
                        note="Above what you paid in"
                        trend="up"
                    />
                    <Kpi
                        label="Tax if realised"
                        value={final ? compact(final.taxIfRealised, symbol) : "—"}
                        note={`At ${pct(parameters.taxBracket, 0)} on gains`}
                        trend="down"
                    />
                    <Kpi
                        label="Real return"
                        value={pct(realAnnualReturn(parameters), 2)}
                        note={`${pct(parameters.expectedYield)} a year, less inflation`}
                        trend="up"
                    />
                </div>
            </section>

            <ProjectionChart series={series} symbol={symbol} />

            {/* The rule is the point: everything below it is measured, not
                assumed. */}
            <div className="h-px w-full bg-border" aria-hidden="true" />

            {/* ── Measured ──────────────────────────────────────────────── */}
            <section className="flex flex-col gap-3">
                <SectionHeading
                    title="From your budget"
                    detail={
                        hasBudget
                            ? "Your current month, not part of the projection."
                            : "Nothing here yet — these fill in once you build a budget."
                    }
                />
                {hasBudget ? (
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                        <Kpi
                            label="Savings rate"
                            value={pct(savingsRate(budget.monthlyIncome, budget.monthlyExpenses))}
                            note="Income kept, not spent"
                            trend={
                                budget.monthlyIncome > budget.monthlyExpenses ? "up" : "down"
                            }
                        />
                        <Kpi
                            label="Monthly burn"
                            value={money(burn, symbol)}
                            note="What leaves each month"
                            trend="down"
                        />
                        <Kpi
                            label="Spending velocity"
                            value={money(spendingVelocity(budget.monthlyExpenses), symbol)}
                            note="Per day, averaged"
                            trend="down"
                        />
                        <Kpi
                            label="Net balance"
                            value={money(netBalance(budget.monthlyIncome, budget.monthlyExpenses), symbol)}
                            note="Income minus expenses"
                            trend={budget.monthlyNet >= 0 ? "up" : "down"}
                        />
                    </div>
                ) : (
                    <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                        Add income and expenses in Budgeting and this row shows your real savings
                        rate, burn and net alongside the model.
                    </p>
                )}

                {runway !== null && (
                    <p className="text-sm text-muted-foreground">
                        At today&rsquo;s burn, the projected balance would cover{" "}
                        <span className="figure text-foreground">{runway.toFixed(0)} months</span> of
                        expenses — in today&rsquo;s money, before tax.
                    </p>
                )}
            </section>
        </div>
    )
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
    return (
        <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {title}
            </h2>
            <p className="text-sm text-muted-foreground">{detail}</p>
        </div>
    )
}

/**
 * One figure. The trend arrow says which direction this metric is pointing by
 * its nature — growth up, cost down — not whether it changed since last time,
 * which nothing here tracks.
 */
function Kpi({
    label,
    value,
    note,
    trend = "flat",
}: {
    label: string
    value: string
    note?: string
    trend?: "up" | "down" | "flat"
}) {
    const Icon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus
    return (
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium leading-tight text-muted-foreground">{label}</p>
                <Icon
                    className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        trend === "up" && "text-positive",
                        trend === "down" && "text-negative",
                        trend === "flat" && "text-muted-foreground"
                    )}
                    aria-hidden="true"
                />
            </div>
            <p className="figure text-2xl leading-none text-foreground">{value}</p>
            {note && <p className="text-[11px] leading-tight text-muted-foreground">{note}</p>}
        </div>
    )
}

type ChartPoint = { year: number; balance: number; realBalance: number; contributed: number }

/**
 * Nominal balance against its value in today's money.
 *
 * Two areas rather than one, because the gap between them is the thing worth
 * seeing: it's what inflation takes, and it widens with the horizon in a way a
 * single line can't show.
 */
function ProjectionChart({
    series,
    symbol,
}: {
    series: ReturnType<typeof project>
    symbol: string
}) {
    const data: ChartPoint[] = series.map((point) => ({
        year: point.year,
        balance: point.balance,
        realBalance: point.realBalance,
        contributed: point.contributed,
    }))

    return (
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-bold text-foreground">Balance over time</h3>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <LegendKey className="bg-primary">Nominal</LegendKey>
                    <LegendKey className="bg-caution">Today&rsquo;s money</LegendKey>
                </div>
            </div>

            <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <defs>
                            <linearGradient id="fill-nominal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="rgb(var(--primary))" stopOpacity={0.2} />
                                <stop offset="100%" stopColor="rgb(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="fill-real" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="rgb(var(--caution))" stopOpacity={0.18} />
                                <stop offset="100%" stopColor="rgb(var(--caution))" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid
                            vertical={false}
                            stroke="rgb(var(--border))"
                            strokeDasharray="3 3"
                        />
                        <XAxis
                            dataKey="year"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "rgb(var(--muted-foreground))", fontSize: 11 }}
                            tickFormatter={(year: number) => (year === 0 ? "now" : `${year}y`)}
                        />
                        <YAxis
                            width={56}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "rgb(var(--muted-foreground))", fontSize: 11 }}
                            tickFormatter={(value: number) => compact(value, symbol)}
                        />
                        <Tooltip
                            cursor={{ stroke: "rgb(var(--border-strong))" }}
                            content={<ModelTooltip symbol={symbol} />}
                        />
                        <Area
                            type="monotone"
                            dataKey="balance"
                            stroke="rgb(var(--primary))"
                            strokeWidth={2}
                            fill="url(#fill-nominal)"
                        />
                        <Area
                            type="monotone"
                            dataKey="realBalance"
                            stroke="rgb(var(--caution))"
                            strokeWidth={2}
                            strokeDasharray="4 3"
                            fill="url(#fill-real)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </section>
    )
}

function LegendKey({ className, children }: { className?: string; children: ReactNode }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", className)} aria-hidden="true" />
            {children}
        </span>
    )
}

function ModelTooltip({
    active,
    payload,
    label,
    symbol,
}: TooltipProps<number, string> & { symbol: string }) {
    if (!active || !payload?.length) return null
    const point = payload[0].payload as ChartPoint

    return (
        <div className="rounded-lg border border-border bg-popover/95 p-3 shadow-lg backdrop-blur-md">
            <p className="pb-1.5 text-xs font-semibold text-popover-foreground">
                {label === 0 ? "Today" : `Year ${label}`}
            </p>
            <dl className="flex flex-col gap-1 text-xs">
                <TooltipRow label="Nominal" value={money(point.balance, symbol)} />
                <TooltipRow label="Today's money" value={money(point.realBalance, symbol)} />
                <TooltipRow label="You paid in" value={money(point.contributed, symbol)} />
            </dl>
        </div>
    )
}

function TooltipRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-6">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="figure text-popover-foreground">{value}</dd>
        </div>
    )
}
