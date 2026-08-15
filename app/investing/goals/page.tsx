"use client"

import Link from "next/link"
import { useEffect, useState, type FormEvent } from "react"
import { Check, Pencil, Plus, Trash2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { calcValue, compactMoney, fixed } from "@/lib/format"
import { GOAL_EMOJI_PALETTE, GOAL_RING_PALETTE, goalRingColor, suggestGoalEmoji } from "@/lib/budget/goals"
import { marketStats } from "@/lib/investing/market"
import { accounts as fetchAccounts, orders as fetchOrders, type Order } from "@/lib/investing/snaptrade"
import { holdings, provisionalPositions, type Holding } from "@/lib/investing/analytics"
import { GoalRing } from "@/components/budget/charts"
import { Button, Notice } from "@/components/ui/primitives"

/**
 * Investing goals — ported from Features/Investing/InvestingGoals.swift, in the
 * shape the web can measure honestly.
 *
 * A goal watches either the whole portfolio or named symbols, and targets
 * either a dollar value or a total gain. The app also has "balance" goals
 * scoped by sector or asset class; those need per-symbol fundamentals this
 * backend no longer carries, so the symbol-scoped form is what ships here.
 *
 * Goals live in localStorage under the app's own key
 * (`finnacalc.investing.goals`) and are measured against live positions.
 */

const KEY = "finnacalc.investing.goals"

type InvestingGoal = {
    id: string
    name: string
    emoji?: string | null
    ringColorHex?: string | null
    /** Empty = the whole portfolio. */
    symbols: string[]
    targetKind: "amount" | "percent"
    targetValue: number
}

function measure(goal: InvestingGoal, rows: Holding[]): { current: number; target: number; fraction: number } {
    const scoped = goal.symbols.length
        ? rows.filter((row) => goal.symbols.includes(row.symbol))
        : rows
    const value = scoped.reduce((sum, row) => sum + row.value, 0)

    if (goal.targetKind === "amount") {
        const target = goal.targetValue
        return { current: value, target, fraction: target > 0 ? Math.min(value / target, 1) : 0 }
    }

    // Percent goals measure gain against cost, which is value − unrealized.
    const gain = scoped.reduce((sum, row) => sum + (row.openPnl ?? 0), 0)
    const cost = value - gain
    const pct = cost > 0 ? (gain / cost) * 100 : 0
    return {
        current: pct,
        target: goal.targetValue,
        fraction: goal.targetValue > 0 ? Math.min(Math.max(pct / goal.targetValue, 0), 1) : 0,
    }
}

export default function InvestingGoalsPage() {
    const [goals, setGoals] = useState<InvestingGoal[]>([])
    const [ready, setReady] = useState(false)
    const [rows, setRows] = useState<Holding[]>([])
    const [connected, setConnected] = useState<boolean | null>(null)
    const [editing, setEditing] = useState<InvestingGoal | null>(null)
    const [adding, setAdding] = useState(false)

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(KEY)
            setGoals(raw ? (JSON.parse(raw) as InvestingGoal[]) : [])
        } catch {
            setGoals([])
        }
        setReady(true)
    }, [])

    useEffect(() => {
        if (!ready) return
        try {
            window.localStorage.setItem(KEY, JSON.stringify(goals))
        } catch {
            /* private mode */
        }
    }, [goals, ready])

    useEffect(() => {
        let active = true
        ;(async () => {
            try {
                const response = await fetchAccounts()
                if (!active) return
                setConnected(response.accounts.length > 0)
                if (response.accounts.length === 0) return

                const orderResponses = await Promise.all(
                    response.accounts.map((account) =>
                        fetchOrders(account.id).catch(() => ({ orders: [] as Order[] }))
                    )
                )
                const allOrders = orderResponses.flatMap((entry) => entry.orders)
                const positions = [
                    ...response.positions,
                    ...provisionalPositions(allOrders, response.positions.map((p) => p.symbol)),
                ]
                const unpriced = [
                    ...new Set(
                        positions
                            .filter((p) => p.marketValue === null && p.price === null)
                            .map((p) => p.symbol.toUpperCase())
                    ),
                ].slice(0, 6)
                let prices: Record<string, number> = {}
                if (unpriced.length > 0) {
                    const stats = await marketStats(unpriced).catch(() => ({ stats: [] }))
                    prices = Object.fromEntries(stats.stats.map((s) => [s.symbol.toUpperCase(), s.price]))
                }
                if (active) setRows(holdings(positions, prices))
            } catch {
                if (active) setConnected(false)
            }
        })()
        return () => {
            active = false
        }
    }, [])

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-6">
            <header className="flex flex-col gap-1">
                <Link href="/investing" className="text-sm font-semibold text-primary">
                    ← Investing
                </Link>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Investing goals</h1>
                <p className="text-sm text-muted-foreground">
                    A target for the portfolio, or for the part of it you choose. Measured against your live
                    holdings.
                </p>
            </header>

            {connected === false && (
                <Notice tone="info">
                    No brokerage connected, so goals have nothing to measure against.{" "}
                    <Link href="/investing/portfolio" className="font-semibold text-primary">
                        Connect one
                    </Link>{" "}
                    and these fill in.
                </Notice>
            )}

            {!adding && !editing && (
                <Button className="self-start" onClick={() => setAdding(true)}>
                    <Plus className="h-4 w-4" />
                    New goal
                </Button>
            )}

            {(adding || editing) && (
                <GoalForm
                    goal={editing}
                    onCancel={() => {
                        setAdding(false)
                        setEditing(null)
                    }}
                    onSave={(draft) => {
                        setGoals((prev) =>
                            editing
                                ? prev.map((goal) => (goal.id === editing.id ? { ...editing, ...draft } : goal))
                                : [...prev, { ...draft, id: crypto.randomUUID() }]
                        )
                        setAdding(false)
                        setEditing(null)
                    }}
                />
            )}

            {goals.length === 0 && !adding ? (
                <div className="flex items-center gap-4 rounded-card border-[1.5px] border-border bg-card p-5">
                    <GoalRing fraction={0} color="rgb(var(--positive))" size={69}>
                        📈
                    </GoalRing>
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-semibold text-foreground">Set an investing goal</p>
                        <p className="text-xs text-muted-foreground">
                            A dollar value to reach, or a gain to hit.
                        </p>
                    </div>
                </div>
            ) : (
                <ul className="flex flex-col gap-3">
                    {goals.map((goal) => {
                        const m = measure(goal, rows)
                        const color = goalRingColor(goal.ringColorHex) ?? "rgb(var(--positive))"
                        return (
                            <li
                                key={goal.id}
                                className="flex items-center gap-4 rounded-card border-[1.5px] border-border bg-card p-4"
                            >
                                <GoalRing fraction={m.fraction} color={color} size={56}>
                                    {goal.emoji || suggestGoalEmoji(goal.name)}
                                </GoalRing>
                                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <p className="truncate text-sm font-semibold text-foreground">{goal.name}</p>
                                    <p className="figure text-[11px] font-normal text-muted-foreground">
                                        {goal.targetKind === "amount"
                                            ? `${compactMoney(m.current)} / ${compactMoney(m.target)}`
                                            : `${fixed(m.current, 1)}% / ${fixed(m.target, 1)}% gain`}
                                        {goal.symbols.length > 0 ? ` · ${goal.symbols.join(", ")}` : " · whole portfolio"}
                                    </p>
                                    <p className={cn("figure text-[11px] font-normal text-positive")}>
                                        {Math.round(m.fraction * 100)}% there
                                    </p>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    <button type="button" onClick={() => setEditing(goal)} aria-label={`Edit ${goal.name}`}>
                                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                    </button>
                                    <button
                                        type="button"
                                        aria-label={`Delete ${goal.name}`}
                                        onClick={() => {
                                            if (window.confirm(`Delete "${goal.name}"? Your holdings are untouched.`)) {
                                                setGoals((prev) => prev.filter((entry) => entry.id !== goal.id))
                                            }
                                        }}
                                    >
                                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground transition hover:text-destructive" />
                                    </button>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}

function GoalForm({
    goal,
    onSave,
    onCancel,
}: {
    goal: InvestingGoal | null
    onSave: (goal: Omit<InvestingGoal, "id">) => void
    onCancel: () => void
}) {
    const [name, setName] = useState(goal?.name ?? "")
    const [symbols, setSymbols] = useState(goal?.symbols.join(", ") ?? "")
    const [targetKind, setTargetKind] = useState<"amount" | "percent">(goal?.targetKind ?? "amount")
    const [targetValue, setTargetValue] = useState(goal ? String(goal.targetValue) : "")
    const [emoji, setEmoji] = useState<string | null>(goal?.emoji ?? null)
    const [ring, setRing] = useState<string | null>(goal?.ringColorHex ?? null)

    function submit(event: FormEvent) {
        event.preventDefault()
        if (!name.trim() || !(calcValue(targetValue) > 0)) return
        onSave({
            name: name.trim(),
            symbols: symbols
                .split(",")
                .map((symbol) => symbol.trim().toUpperCase())
                .filter(Boolean),
            targetKind,
            targetValue: calcValue(targetValue),
            emoji,
            ringColorHex: ring,
        })
    }

    return (
        <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{goal ? "Edit goal" : "New goal"}</p>
                <button type="button" onClick={onCancel} aria-label="Cancel">
                    <X className="h-4 w-4 text-muted-foreground" />
                </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                    Name
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="First $10k" className={FIELD} />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                    Target
                    <select
                        value={targetKind}
                        onChange={(e) => setTargetKind(e.target.value as "amount" | "percent")}
                        className={FIELD}
                    >
                        <option value="amount">Reach a value</option>
                        <option value="percent">Total gain %</option>
                    </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                    {targetKind === "amount" ? "Value" : "Gain %"}
                    <input
                        value={targetValue}
                        onChange={(e) => setTargetValue(e.target.value)}
                        inputMode="decimal"
                        className={cn(FIELD, "figure")}
                    />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                    Symbols
                    <input
                        value={symbols}
                        onChange={(e) => setSymbols(e.target.value.toUpperCase())}
                        placeholder="Blank = whole portfolio"
                        className={FIELD}
                    />
                </label>
            </div>

            <div className="flex flex-wrap gap-1">
                <button
                    type="button"
                    onClick={() => setEmoji(null)}
                    className={cn(
                        "rounded-md px-2 py-1 text-xs font-semibold",
                        emoji === null ? "bg-primary/15 text-primary" : "text-muted-foreground"
                    )}
                >
                    Auto
                </button>
                {GOAL_EMOJI_PALETTE.slice(0, 18).map((option) => (
                    <button
                        key={option}
                        type="button"
                        onClick={() => setEmoji(option)}
                        aria-label={`Use ${option}`}
                        className={cn("h-8 w-8 rounded-md text-lg", emoji === option ? "bg-primary/15" : "hover:bg-secondary")}
                    >
                        {option}
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
                {GOAL_RING_PALETTE.map((hex) => (
                    <button
                        key={hex}
                        type="button"
                        onClick={() => setRing(hex)}
                        aria-label={`Ring colour #${hex}`}
                        className={cn("h-6 w-6 rounded-full border-2", ring === hex ? "border-foreground" : "border-transparent")}
                        style={{ backgroundColor: `#${hex}` }}
                    />
                ))}
            </div>

            <div className="flex gap-2">
                <Button type="submit" disabled={!name.trim() || !(calcValue(targetValue) > 0)}>
                    <Check className="h-4 w-4" />
                    {goal ? "Save changes" : "Add goal"}
                </Button>
                <Button type="button" variant="ghost" onClick={onCancel}>
                    Cancel
                </Button>
            </div>
        </form>
    )
}

const FIELD =
    "h-10 rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground outline-none transition focus:border-primary"
