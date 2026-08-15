/**
 * The local, deterministic findings behind Budget Analysis — ported from
 * Features/Budgeting/BudgetFindings.swift. Everything here is computed from the
 * budget that is open; nothing calls a model.
 *
 * Guideline figures (15% savings, 3 months of expenses, the 50/30/20 split, 36%
 * of income on debt payments) are exactly that: widely published guidelines,
 * named as such in the copy. The findings compare against them and never tell
 * the user what to do with the difference.
 *
 * The emergency-fund finding only counts goals the user LABELED as one. We
 * cannot know which savings are the cushion, and summing every goal would claim
 * we did; when nothing is labeled the finding says so.
 */

import { compactMoney, fixed, int } from "@/lib/format"
import { measureGoal } from "@/lib/budget/goals"
import {
    isDatedMonth,
    monthDisplayName,
    monthKeyOffset,
    monthlyAmount,
    type BudgetItem,
    type BudgetType,
    type CategorySlice,
    type SavingsGoal,
} from "@/lib/budget/types"

export type FindingTone = "good" | "warn" | "bad"

export type Finding = {
    id: string
    title: string
    detail: string
    tone: FindingTone
    /** Pill label, e.g. "healthy". */
    label: string
    /** Deterministic copy with real figures. No AI. */
    fix: string
    action?: "editBudget" | "openGoals"
    /**
     * Score weight. Informational findings carry 0 and leave the score to the
     * four load-bearing ones (surplus 30 · savings rate 25 · emergency 25 ·
     * goals 20).
     */
    weight: number
}

export type FindingsInput = {
    budgetType: BudgetType
    /** The lines of whatever budget is open. */
    items: BudgetItem[]
    goals: SavingsGoal[]
    /** Every line, for the month-over-month comparison. */
    allItems: BudgetItem[]
    /** The slot the editor has open, so the comparison names real months. */
    slot: string
    monthlyIncome: number
    monthlyExpenses: number
    monthlyNet: number
    expenseByCategory: CategorySlice[]
}

/** Commonly published share-of-income guidelines per personal category. */
export const CATEGORY_GUIDELINES: Record<string, number> = {
    Housing: 30,
    Food: 15,
    Transportation: 15,
    Utilities: 10,
    Entertainment: 10,
    Insurance: 12,
    Healthcare: 10,
}

export function isEmergencyName(name: string): boolean {
    const lower = name.toLowerCase()
    return (
        lower.includes("emergency") ||
        lower.includes("rainy") ||
        lower.includes("safety net") ||
        lower.includes("cushion")
    )
}

/**
 * Months of expenses covered by goals the user labeled as the cushion. null
 * when nothing is labeled, which is different from zero.
 */
export function emergencyMonths(input: FindingsInput): number | null {
    if (!(input.monthlyExpenses > 0)) return null
    const labeled = input.goals.filter((goal) => isEmergencyName(goal.name))
    if (labeled.length === 0) return null
    const total = labeled.reduce((sum, goal) => sum + measureGoal(goal, input.items).current, 0)
    return total / input.monthlyExpenses
}

/**
 * What the open budget CONTRIBUTES to an emergency fund each month: lines whose
 * own name says so. A budget line is a flow, not a balance, so this can never
 * say how much is saved.
 */
export function emergencyContribution(input: FindingsInput): number {
    return input.items
        .filter((item) => isEmergencyName(item.subcategory) || isEmergencyName(item.category))
        .reduce((sum, item) => sum + monthlyAmount(item), 0)
}

export type CategoryMove = {
    category: string
    current: number
    previous: number
    /** Percent change, signed. */
    change: number
    currentLabel: string
    previousLabel: string
}

/**
 * Every qualifying category swing between the open month and the one before it,
 * largest first. Empty when there aren't two dated months to compare, which is
 * most manual budgets.
 */
export function categoryMoves(input: FindingsInput): CategoryMove[] {
    if (!isDatedMonth(input.slot)) return []
    const previousKey = monthKeyOffset(input.slot, -1)
    const thisMonth = input.allItems.filter(
        (item) => item.budgetType === input.budgetType && item.month === input.slot
    )
    const lastMonth = input.allItems.filter(
        (item) => item.budgetType === input.budgetType && item.month === previousKey
    )
    if (thisMonth.length === 0 || lastMonth.length === 0) return []

    const byCategory = (items: BudgetItem[]) => {
        const totals = new Map<string, number>()
        for (const item of items.filter((entry) => entry.type === "expense")) {
            totals.set(item.category, (totals.get(item.category) ?? 0) + monthlyAmount(item))
        }
        return totals
    }
    const now = byCategory(thisMonth)
    const previous = byCategory(lastMonth)

    const moves: CategoryMove[] = []
    for (const [category, previousValue] of previous) {
        // Both floors matter: a $4 line tripling is noise, and a brand-new
        // category has no baseline to compare against.
        const currentValue = now.get(category)
        if (previousValue < 15 || currentValue === undefined) continue
        const change = ((currentValue - previousValue) / previousValue) * 100
        if (Math.abs(change) < 10 || Math.abs(currentValue - previousValue) < 15) continue
        moves.push({
            category,
            current: currentValue,
            previous: previousValue,
            change,
            currentLabel: `in ${monthDisplayName(input.slot)}`,
            previousLabel: `in ${monthDisplayName(previousKey)}`,
        })
    }
    return moves.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
}

function goalPace(goal: SavingsGoal, items: BudgetItem[]): Finding | null {
    const measured = measureGoal(goal, items)
    const remaining = measured.target - measured.current
    if (!(remaining > 0)) return null
    const target = new Date(goal.targetDate)
    if (Number.isNaN(target.getTime())) return null

    const days = Math.round((target.getTime() - Date.now()) / 86_400_000)
    const monthsLeft = days > 0 ? Math.ceil(days / 30.44) : 0
    const needed = monthsLeft > 0 ? remaining / monthsLeft : remaining
    if (!(needed > 0) || goal.monthlyContribution >= needed) return null
    const shortfall = needed - goal.monthlyContribution

    const fix =
        goal.monthlyContribution > 0
            ? `At ${compactMoney(goal.monthlyContribution)}/mo, ${goal.name} funds in ~${Math.ceil(
                  remaining / goal.monthlyContribution
              )} months; it needs ${compactMoney(needed)}/mo to land by the target date.`
            : `No monthly plan set. ${compactMoney(needed)}/mo funds ${goal.name} by its target date.`

    const severe = shortfall >= needed * 0.25
    return {
        id: `goal-${goal.id}`,
        title: `${goal.name} pace`,
        detail: `${compactMoney(goal.monthlyContribution)}/mo of ${compactMoney(needed)}/mo needed`,
        tone: severe ? "bad" : "warn",
        label: severe ? "off pace" : `${compactMoney(shortfall)}/mo short`,
        fix,
        action: "openGoals",
        weight: 0,
    }
}

export function computeFindings(input: FindingsInput): Finding[] {
    const { monthlyIncome: income, monthlyExpenses: expenses, monthlyNet: net } = input
    if (!(income > 0 || expenses > 0)) return []

    const out: Finding[] = []
    const savingsRate = income > 0 ? (net / income) * 100 : 0
    const categories = [...input.expenseByCategory].sort((a, b) => b.value - a.value)

    // Monthly surplus (weight 30)
    {
        const top = categories[0]
        const fix =
            net > 0
                ? `You keep ${compactMoney(net)}/mo unassigned. Zero-based budgeting, which many budgeting guides recommend, gives every dollar a job: a goal, a category cap, or an extra debt payment.`
                : net === 0
                  ? "Income and spending land exactly even, so nothing is left to put toward a goal."
                  : `You spend ${compactMoney(Math.abs(net))}/mo more than you earn. Start with your top category, ${
                        top?.name ?? "your largest expense"
                    } at ${compactMoney(top?.value ?? 0)}/mo.`
        out.push({
            id: "surplus",
            title: "Monthly surplus",
            detail: `${net >= 0 ? "+" : "−"}$${int(Math.abs(net))} per month`,
            tone: net > 0 ? "good" : net === 0 ? "warn" : "bad",
            label: net > 0 ? "healthy" : net === 0 ? "break-even" : "overspent",
            fix,
            action: "editBudget",
            weight: 30,
        })
    }

    // Biggest expense, measured against the published guideline for its category.
    if (categories[0] && expenses > 0) {
        const top = categories[0]
        const share = (top.value / expenses) * 100
        const concentrated = share >= 50 && categories.length > 1
        const shareOfIncome = income > 0 ? (top.value / income) * 100 : null
        const guideline = CATEGORY_GUIDELINES[top.name]

        let fix: string
        let tone: FindingTone
        let label: string
        if (guideline !== undefined && shareOfIncome !== null) {
            const guidelineAmount = (income * guideline) / 100
            if (shareOfIncome > guideline) {
                fix = `${top.name} takes ${fixed(shareOfIncome, 0)}% of your income. Budgeting guides commonly keep it near ${fixed(
                    guideline,
                    0
                )}%, which is about ${compactMoney(guidelineAmount)}/mo at your income; yours runs ${compactMoney(
                    top.value - guidelineAmount
                )}/mo above that mark.`
                tone = "warn"
                label = `${fixed(shareOfIncome, 0)}% of income`
            } else {
                fix = `${top.name} takes ${fixed(shareOfIncome, 0)}% of your income, inside the ~${fixed(
                    guideline,
                    0
                )}% budgeting guides commonly suggest.`
                tone = "good"
                label = "within guideline"
            }
        } else {
            fix =
                `Your largest line, at ${fixed(share, 0)}% of spending` +
                (shareOfIncome !== null ? ` and ${fixed(shareOfIncome, 0)}% of income` : "") +
                "."
            tone = concentrated ? "warn" : "good"
            label = concentrated ? "concentrated" : `${fixed(share, 0)}% of spending`
        }
        if (concentrated) {
            fix += " Half or more of all spending sits in this one category, so a change here moves the whole budget."
        }
        out.push({
            id: "biggest",
            title: `Biggest expense: ${top.name}`,
            detail: `${compactMoney(top.value)}/mo · ${fixed(share, 0)}% of spending`,
            tone,
            label,
            fix,
            action: "editBudget",
            weight: 0,
        })
    }

    // Biggest month-over-month move (informational; needs two dated months).
    const move = categoryMoves(input)[0]
    if (move) {
        const direction = move.change > 0 ? "up" : "down"
        const pct = Math.abs(move.change)
        out.push({
            id: "delta",
            title: `${move.category} ${direction} ${fixed(pct, 0)}% ${move.currentLabel}`,
            detail: `${compactMoney(move.current)} ${move.currentLabel} · ${compactMoney(move.previous)} ${move.previousLabel}`,
            tone: move.change > 0 ? "warn" : "good",
            label: `${direction} ${fixed(pct, 0)}%`,
            // States the two figures, the window each covers, and stops.
            fix: `${move.category} is at ${compactMoney(move.current)} ${move.currentLabel}, against ${compactMoney(
                move.previous
            )} ${move.previousLabel}. That is the biggest change of any category, and both figures cover the same length of time.`,
            action: "editBudget",
            weight: 0,
        })
    }

    // Needs / wants / savings vs the 50/30/20 guide (personal only).
    if (input.budgetType === "personal" && income > 0 && expenses > 0) {
        const needsSet = new Set([
            "Housing", "Utilities", "Food", "Transportation", "Healthcare", "Insurance", "Debt Payments",
        ])
        const savingsSet = new Set(["Savings", "Retirement"])
        let needs = 0
        let wants = 0
        let saved = 0
        for (const category of categories) {
            if (needsSet.has(category.name)) needs += category.value
            else if (savingsSet.has(category.name)) saved += category.value
            else wants += category.value
        }
        // What's left over is saving too, even if it never got a category.
        saved += Math.max(net, 0)
        const n = (needs / income) * 100
        const w = (wants / income) * 100
        const s = (saved / income) * 100
        out.push({
            id: "split",
            title: "Needs, wants, and saving",
            detail: `${fixed(n, 0)} / ${fixed(w, 0)} / ${fixed(s, 0)} of income, in %`,
            tone: n <= 55 && s >= 15 ? "good" : n <= 65 ? "warn" : "bad",
            label: n <= 55 && s >= 15 ? "balanced" : "needs-heavy",
            fix: `The 50/30/20 guide many budgeting sites use puts needs at 50% of income, wants at 30%, and saving at 20%. Yours splits ${fixed(
                n,
                0
            )} / ${fixed(w, 0)} / ${fixed(s, 0)}, counting what's left over as saving. An estimate: only you know which lines are truly needs.`,
            action: "editBudget",
            weight: 0,
        })
    }

    // Debt payments vs income (informational; only when the line exists).
    const debtNames = new Set(["Debt Payments", "Loan Payments"])
    const debt = categories.filter((c) => debtNames.has(c.name)).reduce((sum, c) => sum + c.value, 0)
    if (debt > 0 && income > 0) {
        const share = (debt / income) * 100
        out.push({
            id: "debt",
            title: "Debt payments",
            detail: `${compactMoney(debt)}/mo · ${fixed(share, 0)}% of income`,
            tone: share < 20 ? "good" : share <= 36 ? "warn" : "bad",
            label: share < 20 ? "manageable" : share <= 36 ? `${fixed(share, 0)}% of income` : "heavy",
            fix: `A common guideline keeps all debt payments under 36% of income; yours take ${fixed(
                share,
                0
            )}%. High-interest balances, usually credit cards, are the ones most guides suggest looking at first.`,
            action: "editBudget",
            weight: 0,
        })
    }

    // Savings rate (weight 25)
    if (income > 0) {
        const neededForTarget = income * 0.15 - net
        out.push({
            id: "savingsRate",
            title: "Savings rate",
            detail: `${fixed(savingsRate, 1)}% of income`,
            tone: savingsRate >= 15 ? "good" : savingsRate >= 5 ? "warn" : "bad",
            label: savingsRate >= 15 ? "excellent" : savingsRate >= 5 ? "thin" : "too low",
            fix:
                savingsRate >= 15
                    ? `Saving ${fixed(savingsRate, 1)}% of income, at or above the 15% guideline. Keep it up.`
                    : `The common guideline is 15 to 20%. Freeing up ${compactMoney(
                          Math.max(neededForTarget, 0)
                      )}/mo of spending would reach 15%.`,
            action: "editBudget",
            weight: 25,
        })
    }

    // Emergency fund (weight 25) — labeled goals only, and honest when nothing is.
    if (expenses > 0) {
        const low = expenses * 3
        const high = expenses * 6
        const months = emergencyMonths(input)
        if (months !== null) {
            out.push({
                id: "emergency",
                title: "Emergency fund",
                detail: `${fixed(months, 1)} of 3.0 months covered`,
                tone: months >= 3 ? "good" : months >= 1 ? "warn" : "bad",
                label: months >= 3 ? "covered" : months >= 1 ? "building" : "exposed",
                fix:
                    months >= 3
                        ? `${fixed(months, 1)} months of expenses in your emergency goals, inside the 3-to-6-month range experts commonly suggest.`
                        : net > 0
                          ? `Experts commonly suggest 3 to 6 months of expenses, ${compactMoney(low)} to ${compactMoney(
                                high
                            )} for you. Routing ${compactMoney(net)}/mo of surplus toward it is one way it grows.`
                          : `Experts commonly suggest 3 to 6 months of expenses, ${compactMoney(low)} to ${compactMoney(
                                high
                            )} for you. A surplus has to come first, because a cushion can't be funded while overspending.`,
                action: "openGoals",
                weight: 25,
            })
        } else {
            const contribution = emergencyContribution(input)
            if (contribution > 0) {
                // The budget itself names one: a line titled Emergency fund. We
                // know it exists and what goes in each month; the balance is the
                // one thing a budget line can't say.
                out.push({
                    id: "emergency",
                    title: "Emergency fund",
                    detail: `${compactMoney(contribution)}/mo set aside · saved total unknown`,
                    tone: "warn",
                    label: "building",
                    fix: `Your budget puts ${compactMoney(
                        contribution
                    )}/mo toward it. Experts commonly suggest 3 to 6 months of expenses saved, ${compactMoney(
                        low
                    )} to ${compactMoney(
                        high
                    )} for you; a budget line can't tell us how much is already there. Name a goal Emergency Fund with the saved amount and this tracks the total itself.`,
                    action: "openGoals",
                    weight: 25,
                })
            } else {
                const surplusLine =
                    net > 0
                        ? ` If it doesn't exist yet, the ${compactMoney(net)}/mo you currently keep is where many guides suggest it starts.`
                        : ""
                out.push({
                    id: "emergency",
                    title: "Emergency fund",
                    detail: `Unknown to us: ${compactMoney(low)} to ${compactMoney(high)} is the common guideline`,
                    tone: "warn",
                    label: "unknown",
                    fix: `Your expenses are ${compactMoney(
                        expenses
                    )}/mo, and experts commonly suggest keeping 3 to 6 months of them saved: ${compactMoney(
                        low
                    )} to ${compactMoney(
                        high
                    )} for you. We can't see whether you have that. If you do, name a goal Emergency Fund and this tracks itself.${surplusLine}`,
                    action: "openGoals",
                    weight: 25,
                })
            }
        }
    }

    // Goal pace (weight 20, split across off-pace goals)
    const activeGoals = input.goals.filter(
        (goal) => goal.targetAmount > 0 && measureGoal(goal, input.items).current < goal.targetAmount
    )
    if (activeGoals.length > 0) {
        const offPace = activeGoals
            .map((goal) => goalPace(goal, input.items))
            .filter((finding): finding is Finding => finding !== null)
        if (offPace.length === 0) {
            out.push({
                id: "goals",
                title: "Goal pace",
                detail: `${activeGoals.length} goal${activeGoals.length === 1 ? "" : "s"} on track`,
                tone: "good",
                label: "on pace",
                fix: "Every active goal’s planned figure covers what its date needs.",
                action: "openGoals",
                weight: 20,
            })
        } else {
            const each = 20 / offPace.length
            for (const finding of offPace) out.push({ ...finding, weight: each })
        }
    }

    return out
}

/**
 * Weighted roll-up over the load-bearing findings: good = full weight, warn =
 * half, bad = none. Informational findings carry no weight.
 */
export function findingsScore(findings: Finding[]): number {
    const weighted = findings.filter((finding) => finding.weight > 0)
    const totalWeight = weighted.reduce((sum, finding) => sum + finding.weight, 0)
    if (!(totalWeight > 0)) return 0
    const earned = weighted.reduce((sum, finding) => {
        if (finding.tone === "good") return sum + finding.weight
        if (finding.tone === "warn") return sum + finding.weight * 0.5
        return sum
    }, 0)
    return Math.round((earned / totalWeight) * 100)
}

/** "3 look good, 2 need attention" — the hub card's line and the page's opening truth. */
export function findingsSummaryLine(findings: Finding[]): string | null {
    if (findings.length === 0) return null
    const good = findings.filter((finding) => finding.tone === "good").length
    const attention = findings.length - good
    if (attention === 0) return `All ${good} findings look good`
    if (good === 0)
        return `${attention} finding${attention === 1 ? "" : "s"} need${attention === 1 ? "s" : ""} attention`
    return `${good} look${good === 1 ? "s" : ""} good, ${attention} need${attention === 1 ? "s" : ""} attention`
}
