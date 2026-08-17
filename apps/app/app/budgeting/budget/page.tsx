"use client"

import Link from "next/link"
import { useMemo, useRef, useState, type FormEvent } from "react"
import * as Icons from "lucide-react"
import { Calendar, Check, Pencil, Plus, Trash2, Upload, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { calcValue, compactMoney, currency, fixed } from "@/lib/format"
import { useBudget } from "@/components/providers/budget-provider"
import { categoryStyle } from "@/lib/budget/category-style"
import { parseStatement, statementDateRange } from "@/lib/budget/statement"
import {
    FREQUENCIES,
    UNDATED_MONTH,
    budgetTypeTitle,
    categoriesFor,
    currentMonthKey,
    frequencyTitle,
    isDatedMonth,
    monthDisplayName,
    monthlyAmount,
    todayISO,
    type BudgetItem,
    type Frequency,
    type ItemType,
} from "@/lib/budget/types"
import { Donut, DonutLegend } from "@/components/budget/charts"
import { PlaidConnect } from "@/components/budget/plaid-connect"
import { Button, Notice, SectionLabel } from "@/components/ui/primitives"
import { PageBar, PageBody } from "@/components/shell/surface"

/**
 * My Budget — the editor, ported from Features/Budgeting/BudgetTabView.swift:
 * the month slot the budget lives in, its lines grouped by category with the
 * cap bars, the donut, and the ways money gets in (typed, a CSV statement, or a
 * bank connection).
 */
export default function MyBudgetPage() {
    const budget = useBudget()
    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [editing, setEditing] = useState<BudgetItem | null>(null)
    const [adding, setAdding] = useState<ItemType | null>(null)
    const fileInput = useRef<HTMLInputElement | null>(null)

    const expenses = budget.expenseByCategory
    const income = budget.incomeByCategory
    const hasBudget = budget.monthlyIncome > 0 || budget.monthlyExpenses > 0

    const grouped = useMemo(() => {
        const map = new Map<string, BudgetItem[]>()
        for (const item of budget.currentItems) {
            map.set(item.category, [...(map.get(item.category) ?? []), item])
        }
        return [...map.entries()].sort((a, b) => {
            const totalA = a[1].reduce((sum, item) => sum + monthlyAmount(item), 0)
            const totalB = b[1].reduce((sum, item) => sum + monthlyAmount(item), 0)
            return totalB - totalA
        })
    }, [budget.currentItems])

    function importStatement(event: FormEvent<HTMLInputElement>) {
        const file = event.currentTarget.files?.[0]
        if (!file) return
        setError(null)
        setNotice(null)
        file.text().then((text) => {
            const result = parseStatement(text, budget.budgetType)
            if ("error" in result) {
                setError(result.error)
                return
            }
            const combine = budget.currentItems.length > 0 && window.confirm(
                `Add these ${result.items.length} lines to the budget you have open?\n\nOK adds them alongside what's there. Cancel replaces the open budget with the import.`
            )
            budget.landImport(result.items, combine)
            const range = statementDateRange(result.items)
            setNotice(
                `Imported ${result.items.length} lines${
                    range ? ` covering ${range.start.toLocaleDateString()} – ${range.end.toLocaleDateString()}` : ""
                }.`
            )
        })
        if (fileInput.current) fileInput.current.value = ""
    }

    function saveToMonth() {
        const suggested = isDatedMonth(budget.slot) ? budget.slot : currentMonthKey()
        const answer = window.prompt(
            "Save this budget to a month (yyyy-MM). Its lines move to that month; the working budget is then empty.",
            suggested
        )
        if (!answer) return
        if (!/^\d{4}-\d{2}$/.test(answer)) {
            setError("A month looks like 2026-08.")
            return
        }
        if (budget.itemsInMonth(answer).length > 0 && answer !== budget.slot) {
            const ok = window.confirm(
                `${monthDisplayName(answer)} already has a budget. Saving here combines the two. Continue?`
            )
            if (!ok) return
        }
        budget.moveItems(budget.slot, answer)
        setNotice(`Saved to ${monthDisplayName(answer)}.`)
    }

    function snapshot() {
        if (budget.currentItems.length === 0) {
            setError("There's nothing in this budget to snapshot yet.")
            return
        }
        const name = window.prompt(
            "Name this snapshot",
            isDatedMonth(budget.slot) ? monthDisplayName(budget.slot) : `Budget · ${todayISO()}`
        )
        if (!name) return
        budget.saveSnapshot({ name, startDate: todayISO(), endDate: todayISO() })
        setNotice("Saved to History.")
    }

    return (
        <>
            <PageBar
                title={
                    <span className="flex items-center gap-2">
                        <Link href="/budgeting" className="text-muted-foreground hover:text-foreground">
                            Budgeting
                        </Link>
                        <span className="text-border-strong">/</span>
                        My Budget
                    </span>
                }
            />
            <PageBody className="flex w-full max-w-3xl flex-col gap-5">
                <p className="text-sm text-muted-foreground">
                    {budgetTypeTitle(budget.budgetType)} ·{" "}
                    {isDatedMonth(budget.slot) ? monthDisplayName(budget.slot) : "no date set"}
                </p>

            {/* Which budget is open: the working one, or a month it was saved to. */}
            <section className="flex flex-wrap items-center gap-2">
                <SlotChip
                    active={!isDatedMonth(budget.slot)}
                    onClick={() => budget.setSlot(UNDATED_MONTH)}
                    label="Working budget"
                />
                {budget.savedMonths.map((month) => (
                    <SlotChip
                        key={month}
                        active={budget.slot === month}
                        onClick={() => budget.setSlot(month)}
                        label={monthDisplayName(month)}
                        net={budget.savedMonthNets[month]}
                    />
                ))}
                <Button size="sm" variant="ghost" onClick={saveToMonth}>
                    <Calendar className="h-3.5 w-3.5" />
                    {isDatedMonth(budget.slot) ? "Change month" : "Save to a month"}
                </Button>
            </section>

            {notice && <Notice tone="info">{notice}</Notice>}
            {error && <Notice tone="error">{error}</Notice>}

            <section className="flex flex-col gap-3 rounded-card border-[1.5px] border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-4">
                    <Donut
                        slices={expenses}
                        centerLabel={hasBudget ? compactMoney(budget.monthlyExpenses) : undefined}
                    />
                    {expenses.length > 0 ? (
                        <DonutLegend slices={expenses.slice(0, 6)} />
                    ) : (
                        <div className="flex flex-col gap-1">
                            <p className="text-sm font-semibold text-foreground">Add your first expense</p>
                            <p className="text-xs text-muted-foreground">
                                See where your money goes each month.
                            </p>
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
                    <Figure label="In" value={compactMoney(budget.monthlyIncome)} tone="positive" />
                    <Figure label="Out" value={compactMoney(budget.monthlyExpenses)} tone="negative" />
                    <Figure
                        label="Net"
                        value={`${budget.monthlyNet >= 0 ? "+" : "−"}${compactMoney(Math.abs(budget.monthlyNet))}`}
                        tone={budget.monthlyNet >= 0 ? "positive" : "negative"}
                    />
                </div>
            </section>

            <div className="flex flex-wrap gap-2">
                <Button onClick={() => setAdding("income")}>
                    <Plus className="h-4 w-4" />
                    Income
                </Button>
                <Button onClick={() => setAdding("expense")}>
                    <Plus className="h-4 w-4" />
                    Expense
                </Button>
                <Button variant="outline" onClick={() => fileInput.current?.click()}>
                    <Upload className="h-4 w-4" />
                    Import CSV
                </Button>
                <Button variant="outline" onClick={snapshot}>
                    Save snapshot
                </Button>
                <input
                    ref={fileInput}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={importStatement}
                />
            </div>

            {(adding || editing) && (
                <ItemForm
                    item={editing}
                    type={editing?.type ?? adding ?? "expense"}
                    onCancel={() => {
                        setAdding(null)
                        setEditing(null)
                    }}
                    onSave={(item) => {
                        if (editing) budget.updateItem({ ...editing, ...item })
                        else budget.addItem({ ...item, month: budget.slot })
                        setAdding(null)
                        setEditing(null)
                    }}
                />
            )}

            <section className="flex flex-col gap-4">
                {grouped.length === 0 && (
                    <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                        Nothing in this budget yet. Add a line, import a statement, or connect a bank below.
                    </p>
                )}
                {grouped.map(([category, lines]) => (
                    <CategoryGroup
                        key={category}
                        category={category}
                        lines={lines}
                        onEdit={setEditing}
                        onDelete={(id) => budget.deleteItem(id)}
                    />
                ))}
            </section>

            {income.length > 0 && (
                <section className="flex flex-col gap-2">
                    <SectionLabel>Income by source</SectionLabel>
                    <div className="rounded-xl border border-border bg-card p-4">
                        <DonutLegend slices={income} />
                    </div>
                </section>
            )}

            <section className="flex flex-col gap-2">
                <SectionLabel>Bank</SectionLabel>
                <PlaidConnect
                    budgetType={budget.budgetType}
                    onImported={({ items, start, end }) => {
                        budget.saveSnapshot({
                            name: "Bank Import (Plaid)",
                            startDate: start,
                            endDate: end,
                            lines: items,
                        })
                        setNotice(
                            `Imported ${items.length} transactions into History. Open History to bring them into a budget.`
                        )
                    }}
                />
            </section>
            </PageBody>
        </>
    )
}

function Figure({ label, value, tone }: { label: string; value: string; tone: "positive" | "negative" }) {
    return (
        <div className="flex flex-col">
            <span className="text-[11px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                {label}
            </span>
            <span className={cn("figure text-lg font-bold", tone === "positive" ? "text-positive" : "text-negative")}>
                {value}
            </span>
        </div>
    )
}

function SlotChip({
    active,
    onClick,
    label,
    net,
}: {
    active: boolean
    onClick: () => void
    label: string
    net?: number
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
            )}
        >
            {label}
            {net !== undefined && (
                <span className="figure ml-1.5 font-normal">
                    {net >= 0 ? "+" : "−"}
                    {compactMoney(Math.abs(net))}
                </span>
            )}
        </button>
    )
}

/** One category's lines, with its cap bar when a cap is set. */
function CategoryGroup({
    category,
    lines,
    onEdit,
    onDelete,
}: {
    category: string
    lines: BudgetItem[]
    onEdit: (item: BudgetItem) => void
    onDelete: (id: string) => void
}) {
    const budget = useBudget()
    const total = lines.reduce((sum, item) => sum + monthlyAmount(item), 0)
    const style = categoryStyle(category)
    const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[style.icon] ?? Icons.RefreshCw
    const cap = budget.cap(category)
    const isExpense = lines[0]?.type === "expense"

    function editCap() {
        const answer = window.prompt(
            `Monthly cap for ${category} (blank removes it)`,
            cap ? String(cap) : ""
        )
        if (answer === null) return
        budget.setCap(category, answer.trim() === "" ? null : calcValue(answer))
    }

    return (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
                <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md"
                    style={{ backgroundColor: `${style.tint}22`, color: style.tint }}
                >
                    <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="flex-1 text-sm font-semibold text-foreground">{category}</span>
                <span className="figure text-sm font-bold text-foreground">{currency(total, 2)}</span>
                {isExpense && (
                    <button
                        type="button"
                        onClick={editCap}
                        className="text-xs font-semibold text-primary"
                        aria-label={`Set a cap for ${category}`}
                    >
                        {cap ? "Cap" : "Set cap"}
                    </button>
                )}
            </div>

            {cap !== undefined && isExpense && (
                <div className="flex items-center gap-2 px-4 pt-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                        <div
                            className={cn("h-full rounded-full", total > cap ? "bg-negative" : "bg-positive")}
                            style={{ width: `${Math.min(100, (total / cap) * 100)}%` }}
                        />
                    </div>
                    <span
                        className={cn(
                            "figure text-[11px]",
                            total > cap ? "text-negative" : "text-muted-foreground"
                        )}
                    >
                        {fixed((total / cap) * 100, 0)}% of {currency(cap)}
                    </span>
                </div>
            )}

            <ul>
                {lines.map((line) => (
                    <li
                        key={line.id}
                        className="flex items-center gap-3 border-t border-border px-4 py-2.5 first:border-t-0"
                    >
                        <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm text-foreground">
                                {line.subcategory || "(no name)"}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                                {currency(line.amount, 2)} · {frequencyTitle(line.frequency)}
                                {line.isFixed ? " · fixed" : ""}
                                {line.chargeSchedule ? " · subscription" : ""}
                            </span>
                        </span>
                        <span
                            className={cn(
                                "figure text-sm font-semibold",
                                line.type === "income" ? "text-positive" : "text-negative"
                            )}
                        >
                            {line.type === "income" ? "+" : "−"}
                            {currency(monthlyAmount(line), 2)}
                        </span>
                        <button
                            type="button"
                            onClick={() => onEdit(line)}
                            aria-label={`Edit ${line.subcategory}`}
                            className="text-muted-foreground transition hover:text-foreground"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (window.confirm(`Delete "${line.subcategory || "this line"}"? This can't be undone.`)) {
                                    onDelete(line.id)
                                }
                            }}
                            aria-label={`Delete ${line.subcategory}`}
                            className="text-muted-foreground transition hover:text-destructive"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    )
}

type DraftItem = Omit<BudgetItem, "id" | "budgetType">

/** Add / edit one line. Marking it a subscription sets its frequency from the cadence. */
function ItemForm({
    item,
    type,
    onSave,
    onCancel,
}: {
    item: BudgetItem | null
    type: ItemType
    onSave: (item: DraftItem) => void
    onCancel: () => void
}) {
    const budget = useBudget()
    const categories = categoriesFor(type, budget.budgetType)
    const [name, setName] = useState(item?.subcategory ?? "")
    const [amount, setAmount] = useState(item ? String(item.amount) : "")
    const [category, setCategory] = useState(item?.category ?? categories[0])
    const [frequency, setFrequency] = useState<Frequency>(item?.frequency ?? "monthly")
    const [isFixed, setIsFixed] = useState(item?.isFixed ?? false)
    const [subscription, setSubscription] = useState(Boolean(item?.chargeSchedule))
    const [billingDay, setBillingDay] = useState(String(item?.chargeSchedule?.day ?? 1))

    function submit(event: FormEvent) {
        event.preventDefault()
        const value = calcValue(amount)
        if (!(value > 0)) return
        onSave({
            subcategory: name.trim(),
            category,
            amount: value,
            frequency,
            type,
            isFixed,
            month: item?.month ?? budget.slot,
            importDate: item?.importDate ?? null,
            chargeSchedule: subscription
                ? {
                      cadence:
                          frequency === "weekly"
                              ? "weekly"
                              : frequency === "biweekly" || frequency === "semimonthly"
                                ? "biweekly"
                                : frequency === "quarterly"
                                  ? "quarterly"
                                  : frequency === "yearly"
                                    ? "annually"
                                    : "monthly",
                      day: Math.min(Math.max(Number(billingDay) || 1, 1), 31),
                  }
                : null,
        })
    }

    return (
        <form
            onSubmit={submit}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
        >
            <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">
                    {item ? "Edit line" : type === "income" ? "New income" : "New expense"}
                </p>
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
                        placeholder={type === "income" ? "Paycheck" : "Rent"}
                        className={FIELD}
                    />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                    Amount
                    <input
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        inputMode="decimal"
                        placeholder="0"
                        className={cn(FIELD, "figure")}
                    />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                    Category
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className={FIELD}>
                        {categories.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                    Frequency
                    <select
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value as Frequency)}
                        className={FIELD}
                    >
                        {FREQUENCIES.map((option) => (
                            <option key={option} value={option}>
                                {frequencyTitle(option)}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" checked={isFixed} onChange={(e) => setIsFixed(e.target.checked)} />
                    Fixed amount
                </label>
                {type === "expense" && (
                    <label className="flex items-center gap-2 text-sm text-foreground">
                        <input
                            type="checkbox"
                            checked={subscription}
                            onChange={(e) => setSubscription(e.target.checked)}
                        />
                        Subscription
                    </label>
                )}
                {subscription && (
                    <label className="flex items-center gap-2 text-sm text-foreground">
                        Bills on day
                        <input
                            value={billingDay}
                            onChange={(e) => setBillingDay(e.target.value.replace(/[^0-9]/g, ""))}
                            inputMode="numeric"
                            className={cn(FIELD, "figure w-16 text-center")}
                        />
                    </label>
                )}
            </div>

            <div className="flex gap-2">
                <Button type="submit" disabled={!(calcValue(amount) > 0)}>
                    <Check className="h-4 w-4" />
                    {item ? "Save changes" : "Add line"}
                </Button>
                <Button type="button" variant="ghost" onClick={onCancel}>
                    Cancel
                </Button>
            </div>
        </form>
    )
}

const FIELD =
    "h-10 rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
