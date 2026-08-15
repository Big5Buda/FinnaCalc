"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"
import { Check, Pencil, Plus, Trash2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { calcValue, compactMoney, currency } from "@/lib/format"
import { useBudget } from "@/components/providers/budget-provider"
import {
    GOAL_EMOJI_PALETTE,
    GOAL_RING_PALETTE,
    goalIsOver,
    goalRingColor,
    measureGoal,
    resolveGoalEmoji,
    suggestGoalEmoji,
} from "@/lib/budget/goals"
import {
    categoriesFor,
    goalKindTitle,
    goalProgressVerb,
    todayISO,
    type GoalKind,
    type SavingsGoal,
} from "@/lib/budget/types"
import { GoalRing } from "@/components/budget/charts"
import { Button } from "@/components/ui/primitives"

/**
 * Goals — ported from Features/Budgeting/GoalsTabView.swift: emoji rings,
 * progress against a target, a planned monthly contribution, and the three
 * kinds (saving, spending, income).
 *
 * Spending and income goals are measured over the budget lines that are open,
 * or kept by hand — see lib/budget/goals.ts for why the web measures them that
 * way rather than off a live bank ledger.
 */
export default function GoalsPage() {
    const budget = useBudget()
    const [editing, setEditing] = useState<SavingsGoal | null>(null)
    const [adding, setAdding] = useState(false)

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-6">
            <header className="flex flex-col gap-1">
                <Link href="/budgeting" className="text-sm font-semibold text-primary">
                    ← Budgeting
                </Link>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Goals</h1>
                <p className="text-sm text-muted-foreground">
                    What you&rsquo;re saving toward, and how the plan is tracking against its date.
                </p>
            </header>

            {!adding && !editing && (
                <Button onClick={() => setAdding(true)} className="self-start">
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
                    onSave={(goal) => {
                        if (editing) budget.updateGoal({ ...editing, ...goal })
                        else budget.addGoal(goal)
                        setAdding(false)
                        setEditing(null)
                    }}
                />
            )}

            {budget.currentGoals.length === 0 && !adding && (
                <div className="flex items-center gap-4 rounded-card border-[1.5px] border-border bg-card p-5">
                    <GoalRing fraction={0} color="rgb(var(--positive))" size={69}>
                        🎯
                    </GoalRing>
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-semibold text-foreground">Set your first savings goal</p>
                        <p className="text-xs text-muted-foreground">Track progress right here.</p>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-3">
                {budget.currentGoals.map((goal) => (
                    <GoalCard key={goal.id} goal={goal} onEdit={() => setEditing(goal)} />
                ))}
            </div>
        </div>
    )
}

function GoalCard({ goal, onEdit }: { goal: SavingsGoal; onEdit: () => void }) {
    const budget = useBudget()
    const measure = measureGoal(goal, budget.currentItems)
    const over = goalIsOver(goal, measure)
    const color = goalRingColor(goal.ringColorHex) ?? "rgb(var(--positive))"
    const percent = Math.round(measure.fraction * 100)

    function addFunds() {
        const answer = window.prompt(`Add to "${goal.name}" — how much?`, "")
        if (!answer) return
        const amount = calcValue(answer)
        if (amount !== 0) budget.addFunds(goal.id, amount)
    }

    return (
        <article className="flex flex-col gap-3 rounded-card border-[1.5px] border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-4">
                <GoalRing fraction={measure.fraction} color={over ? "rgb(var(--negative))" : color} size={56}>
                    {resolveGoalEmoji(goal)}
                </GoalRing>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="truncate text-sm font-semibold text-foreground">{goal.name}</p>
                    <p className="figure text-[11px] font-normal text-muted-foreground">
                        {compactMoney(measure.current)} / {compactMoney(measure.target)} ·{" "}
                        {goal.targetDate || "no date"}
                    </p>
                    <p
                        className={cn(
                            "figure text-[11px] font-normal",
                            over ? "text-negative" : "text-positive"
                        )}
                    >
                        {percent}% {goalProgressVerb(goal.kind)}
                        {goal.monthlyContribution > 0 &&
                            ` · ${currency(goal.monthlyContribution)}/mo planned`}
                    </p>
                </div>
                <div className="flex shrink-0 gap-2">
                    {goal.kind === "saving" || goal.manualOnly ? (
                        <button
                            type="button"
                            onClick={addFunds}
                            className="text-xs font-semibold text-primary"
                        >
                            Add funds
                        </button>
                    ) : null}
                    <button type="button" onClick={onEdit} aria-label={`Edit ${goal.name}`}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                        type="button"
                        aria-label={`Delete ${goal.name}`}
                        onClick={() => {
                            if (
                                window.confirm(
                                    `Delete "${goal.name}"? The goal and its progress are removed. Your budget lines are kept. This can't be undone.`
                                )
                            ) {
                                budget.deleteGoal(goal.id)
                            }
                        }}
                    >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground transition hover:text-destructive" />
                    </button>
                </div>
            </div>
        </article>
    )
}

type DraftGoal = Omit<SavingsGoal, "id" | "budgetType">

function GoalForm({
    goal,
    onSave,
    onCancel,
}: {
    goal: SavingsGoal | null
    onSave: (goal: DraftGoal) => void
    onCancel: () => void
}) {
    const budget = useBudget()
    const [name, setName] = useState(goal?.name ?? "")
    const [kind, setKind] = useState<GoalKind>(goal?.kind ?? "saving")
    const [target, setTarget] = useState(goal ? String(goal.targetAmount) : "")
    const [current, setCurrent] = useState(goal ? String(goal.currentAmount) : "")
    const [targetDate, setTargetDate] = useState(goal?.targetDate ?? todayISO())
    const [monthly, setMonthly] = useState(goal ? String(goal.monthlyContribution) : "")
    const [emoji, setEmoji] = useState<string | null>(goal?.emoji ?? null)
    const [ring, setRing] = useState<string | null>(goal?.ringColorHex ?? null)
    const [category, setCategory] = useState<string | null>(goal?.category ?? null)

    const suggested = suggestGoalEmoji(name)

    function submit(event: FormEvent) {
        event.preventDefault()
        if (!name.trim() || !(calcValue(target) > 0)) return
        onSave({
            name: name.trim(),
            kind,
            targetAmount: calcValue(target),
            currentAmount: calcValue(current),
            targetDate,
            monthlyContribution: calcValue(monthly),
            emoji,
            ringColorHex: ring,
            category: kind === "saving" ? null : category,
            // The app sets this when a spending/income goal is counted by hand
            // instead of read from a bank. The web measures those kinds over the
            // open budget, so the flag stays off and the app's own meaning of it
            // round-trips untouched.
            manualOnly: goal?.manualOnly ?? false,
            accountIDs: goal?.accountIDs ?? [],
            alerts: goal?.alerts ?? [],
            alertsFired: goal?.alertsFired ?? [],
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
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Emergency fund"
                        className={FIELD}
                    />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                    Kind
                    <select
                        value={kind}
                        onChange={(e) => setKind(e.target.value as GoalKind)}
                        className={FIELD}
                    >
                        {(["saving", "spending", "income"] as GoalKind[]).map((option) => (
                            <option key={option} value={option}>
                                {goalKindTitle(option)}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                    {kind === "spending" ? "Limit" : "Target"}
                    <input
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        inputMode="decimal"
                        placeholder="0"
                        className={cn(FIELD, "figure")}
                    />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                    {kind === "saving" ? "Saved so far" : "Counted so far"}
                    <input
                        value={current}
                        onChange={(e) => setCurrent(e.target.value)}
                        inputMode="decimal"
                        placeholder="0"
                        className={cn(FIELD, "figure")}
                    />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                    Target date
                    <input
                        type="date"
                        value={targetDate}
                        onChange={(e) => setTargetDate(e.target.value)}
                        className={FIELD}
                    />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                    Monthly plan
                    <input
                        value={monthly}
                        onChange={(e) => setMonthly(e.target.value)}
                        inputMode="decimal"
                        placeholder="0"
                        className={cn(FIELD, "figure")}
                    />
                </label>
                {kind !== "saving" && (
                    <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground sm:col-span-2">
                        Category counted
                        <select
                            value={category ?? ""}
                            onChange={(e) => setCategory(e.target.value || null)}
                            className={FIELD}
                        >
                            <option value="">Every category</option>
                            {categoriesFor(kind === "spending" ? "expense" : "income", budget.budgetType).map(
                                (option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                )
                            )}
                        </select>
                    </label>
                )}
            </div>

            <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-foreground">
                    Icon <span className="text-muted-foreground">(default follows the name: {suggested})</span>
                </p>
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
                    {GOAL_EMOJI_PALETTE.map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => setEmoji(option)}
                            aria-label={`Use ${option}`}
                            className={cn(
                                "h-8 w-8 rounded-md text-lg",
                                emoji === option ? "bg-primary/15" : "hover:bg-secondary"
                            )}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-foreground">Ring colour</p>
                <div className="flex flex-wrap gap-1.5">
                    <button
                        type="button"
                        onClick={() => setRing(null)}
                        className={cn(
                            "rounded-md px-2 py-1 text-xs font-semibold",
                            ring === null ? "bg-primary/15 text-primary" : "text-muted-foreground"
                        )}
                    >
                        Default
                    </button>
                    {GOAL_RING_PALETTE.map((hex) => (
                        <button
                            key={hex}
                            type="button"
                            onClick={() => setRing(hex)}
                            aria-label={`Ring colour #${hex}`}
                            className={cn(
                                "h-6 w-6 rounded-full border-2",
                                ring === hex ? "border-foreground" : "border-transparent"
                            )}
                            style={{ backgroundColor: `#${hex}` }}
                        />
                    ))}
                </div>
            </div>

            <div className="flex gap-2">
                <Button type="submit" disabled={!name.trim() || !(calcValue(target) > 0)}>
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
