"use client"

import { cn } from "@/lib/utils"
import { compactMoney, currency, fixed } from "@/lib/format"
import { chartColor } from "@/lib/budget/category-style"
import { Donut, GoalRing } from "@/components/budget/charts"
import { PriceChart } from "@/components/investing/price-chart"

/**
 * Product imagery, rendered from the site's own components rather than
 * exported screenshots — so what the landing shows is the interface that
 * actually ships, and it can't drift into advertising a screen that no longer
 * exists.
 *
 * The figures inside are sample data and are labelled "Example" on the frame.
 * The house rule against fabricated figures is about presenting invented
 * numbers as the reader's own; a marked-up demo isn't that, and being explicit
 * keeps it from becoming that.
 */

export function PhoneFrame({
    children,
    caption = "Example",
    className,
}: {
    children: React.ReactNode
    caption?: string
    className?: string
}) {
    return (
        <div className={cn("flex flex-col items-center gap-3", className)}>
            <div className="relative w-full max-w-[300px] rounded-[42px] border-[10px] border-foreground bg-background p-0 shadow-2xl">
                {/* The notch, drawn rather than imaged. */}
                <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-foreground" />
                <div className="h-[520px] overflow-hidden rounded-[32px] bg-background px-4 pb-4 pt-10">
                    {children}
                </div>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {caption}
            </p>
        </div>
    )
}

const SAMPLE_EXPENSES = [
    { name: "Housing", value: 1450 },
    { name: "Food", value: 620 },
    { name: "Transportation", value: 310 },
    { name: "Other", value: 240 },
]

export function BudgetMockup() {
    const total = SAMPLE_EXPENSES.reduce((sum, slice) => sum + slice.value, 0)
    return (
        <div className="flex h-full flex-col gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                Expenses
            </p>
            <div className="flex items-center gap-3">
                <Donut slices={SAMPLE_EXPENSES} size={88} centerLabel={compactMoney(total)} />
                <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
                    {SAMPLE_EXPENSES.map((slice, index) => (
                        <li key={slice.name} className="flex items-center gap-2">
                            <span
                                className="h-2 w-2 shrink-0 rounded-sm"
                                style={{ backgroundColor: chartColor(index) }}
                            />
                            <span className="truncate text-[11px] font-semibold text-foreground">
                                {slice.name}
                            </span>
                            <span className="figure ml-auto text-[10px] font-normal text-muted-foreground">
                                {compactMoney(slice.value)}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-card p-3 text-center">
                <Figure label="In" value="$4.1k" tone="positive" />
                <Figure label="Out" value={compactMoney(total)} tone="negative" />
                <Figure label="Net" value="+$1.5k" tone="positive" />
            </div>

            <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-muted-foreground">Goals</p>
            <div className="flex flex-col gap-2.5">
                {[
                    { emoji: "🛟", name: "Emergency fund", current: 4200, target: 9000 },
                    { emoji: "✈️", name: "Japan trip", current: 1150, target: 3000 },
                ].map((goal) => (
                    <div
                        key={goal.name}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5"
                    >
                        <GoalRing
                            fraction={goal.current / goal.target}
                            color="rgb(var(--positive))"
                            size={36}
                        >
                            {goal.emoji}
                        </GoalRing>
                        <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-xs font-semibold text-foreground">{goal.name}</span>
                            <span className="figure text-[10px] font-normal text-muted-foreground">
                                {compactMoney(goal.current)} / {compactMoney(goal.target)}
                            </span>
                        </div>
                        <span className="figure text-[11px] font-normal text-muted-foreground">
                            {Math.round((goal.current / goal.target) * 100)}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}

/** A gently rising series — shaped, not a real quote. */
const SAMPLE_SERIES = Array.from({ length: 48 }, (_, index) => {
    const drift = index * 0.9
    const wave = Math.sin(index / 5) * 4 + Math.sin(index / 2.2) * 1.6
    return { t: index, c: 182 + drift + wave }
})

export function InvestingMockup() {
    const first = SAMPLE_SERIES[0].c
    const last = SAMPLE_SERIES[SAMPLE_SERIES.length - 1].c
    const changePct = ((last - first) / first) * 100

    return (
        <div className="flex h-full flex-col gap-3">
            <div className="flex flex-col gap-0.5">
                <p className="text-base font-bold text-foreground">S&amp;P 500 ETF</p>
                <p className="text-xs font-semibold text-muted-foreground">SPY</p>
                <p className="figure text-2xl font-bold text-foreground">${fixed(last, 2)}</p>
                <p className="figure text-xs font-semibold text-positive">
                    +{fixed(last - first, 2)} ({fixed(changePct, 2)}%)
                </p>
            </div>
            <PriceChart points={SAMPLE_SERIES} previousClose={first} height={150} />
            <div className="flex gap-1 rounded-md bg-muted p-1">
                {["1D", "1W", "1M", "1Y", "ALL"].map((range, index) => (
                    <span
                        key={range}
                        className={cn(
                            "flex-1 rounded-sm py-1.5 text-center text-[10px]",
                            index === 2
                                ? "bg-card font-bold text-foreground shadow-sm"
                                : "font-semibold text-muted-foreground"
                        )}
                    >
                        {range}
                    </span>
                ))}
            </div>
            <div className="flex flex-col gap-2">
                {[
                    { symbol: "VOO", name: "Vanguard S&P 500", price: 612.4, change: 0.42 },
                    { symbol: "QQQ", name: "Invesco QQQ", price: 588.13, change: -0.31 },
                ].map((row) => (
                    <div
                        key={row.symbol}
                        className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5"
                    >
                        <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-xs font-semibold text-foreground">{row.name}</span>
                            <span className="text-[10px] text-muted-foreground">{row.symbol}</span>
                        </span>
                        <span className="figure text-[11px] font-semibold text-foreground">
                            ${fixed(row.price, 2)}
                        </span>
                        <span
                            className={cn(
                                "figure text-[10px] font-semibold",
                                row.change >= 0 ? "text-positive" : "text-negative"
                            )}
                        >
                            {row.change >= 0 ? "+" : "−"}
                            {fixed(Math.abs(row.change), 2)}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export function CalculatorMockup() {
    return (
        <div className="flex h-full flex-col gap-3">
            <p className="text-base font-bold text-foreground">Loan Calculator</p>
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
                <Field label="Loan Amount" value="$28,000" />
                <Field label="Interest Rate" value="6.4%" />
                <Field label="Term" value="60 mo" />
            </div>
            <div className="overflow-hidden rounded-md border-l-4 border-primary bg-primary-soft p-3">
                <p className="text-xs font-semibold text-primary">Your Payment Calculation</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                    <Metric label="Monthly payment" value={currency(546.61, 2)} tone="text-positive" />
                    <Metric label="Total paid" value={currency(32796.6, 2)} tone="text-primary" />
                    <Metric label="Total interest" value={currency(4796.6, 2)} tone="text-negative" />
                    <Metric label="Principal" value={currency(28000, 2)} tone="text-accent-purple" />
                </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
                Eleven calculators, all free, nothing to sign up for.
            </p>
        </div>
    )
}

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-foreground">{label}</span>
            <span className="figure flex h-8 items-center rounded-md border border-input bg-background px-2 text-[11px] text-foreground">
                {value}
            </span>
        </div>
    )
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
    return (
        <div className="flex flex-col">
            <span className="text-[9px] text-muted-foreground">{label}</span>
            <span className={cn("figure text-sm font-bold", tone)}>{value}</span>
        </div>
    )
}

function Figure({ label, value, tone }: { label: string; value: string; tone: "positive" | "negative" }) {
    return (
        <div className="flex flex-col">
            <span className="text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                {label}
            </span>
            <span className={cn("figure text-sm font-bold", tone === "positive" ? "text-positive" : "text-negative")}>
                {value}
            </span>
        </div>
    )
}
