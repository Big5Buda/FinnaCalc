/**
 * Budget domain model — ported from the iOS app's
 * Features/Budgeting/BudgetingModels.swift (itself a port of the original
 * app/budgeting/page.tsx). Same shapes and same storage keys as the app, so
 * the two never disagree about what a budget is.
 */

export type BudgetType = "personal" | "business"
export type ItemType = "income" | "expense"

export const BUDGET_TYPES: BudgetType[] = ["personal", "business"]

export function budgetTypeTitle(type: BudgetType): string {
    return type === "personal" ? "Personal" : "Business"
}

export type Frequency =
    | "daily"
    | "weekly"
    | "biweekly"
    | "semimonthly"
    | "monthly"
    | "quarterly"
    | "yearly"

export const FREQUENCIES: Frequency[] = [
    "daily",
    "weekly",
    "biweekly",
    "semimonthly",
    "monthly",
    "quarterly",
    "yearly",
]

export function frequencyTitle(frequency: Frequency): string {
    if (frequency === "biweekly") return "Every 2 weeks"
    if (frequency === "semimonthly") return "Twice a month"
    return frequency.charAt(0).toUpperCase() + frequency.slice(1)
}

/**
 * convertToMonthly multipliers. biweekly and semimonthly are genuinely
 * different rates: every 14 days is 26 charges a year (2.165/mo), while "the
 * 1st and 3rd" is exactly 2 a month. Costing the latter as biweekly overstates
 * it by 8%.
 */
export function monthlyMultiplier(frequency: Frequency): number {
    switch (frequency) {
        case "daily":
            return 30
        case "weekly":
            return 4.33
        case "biweekly":
            return 2.165
        case "semimonthly":
            return 2
        case "monthly":
            return 1
        case "quarterly":
            return 1 / 3
        case "yearly":
            return 1 / 12
    }
}

/** How often a subscription charges. */
export type ChargeCadence = "weekly" | "biweekly" | "monthly" | "quarterly" | "annually"

export function cadenceTitle(cadence: ChargeCadence): string {
    switch (cadence) {
        case "weekly":
            return "Weekly"
        case "biweekly":
            return "Every 2 weeks"
        case "monthly":
            return "Monthly"
        case "quarterly":
            return "Quarterly"
        case "annually":
            return "Annually"
    }
}

/** The budget frequency a cadence implies, so totals and reminders agree. */
export function cadenceFrequency(cadence: ChargeCadence): Frequency {
    switch (cadence) {
        case "weekly":
            return "weekly"
        case "biweekly":
            return "biweekly"
        case "monthly":
            return "monthly"
        case "quarterly":
            return "quarterly"
        case "annually":
            return "yearly"
    }
}

/**
 * When a charge recurs. Non-null on a BudgetItem is the ONLY marker for "this
 * is a subscription" — one field, so the flag and the timing can't contradict
 * each other. `day` is the day of the month for monthly/quarterly/annual
 * cadences; the app also stores weekday anchors, which round-trip untouched.
 */
export type ChargeSchedule = {
    cadence: ChargeCadence
    /** Day of month (1–31) for the cadences that have one. */
    day?: number
    /** Reminders are device notifications — the app schedules them, the web doesn't. */
    remind?: boolean
}

export type BudgetItem = {
    id: string
    category: string
    /** The line's own name — a merchant, a description, whatever the user typed. */
    subcategory: string
    /** Always positive; `type` carries the direction. */
    amount: number
    frequency: Frequency
    type: ItemType
    isFixed: boolean
    budgetType: BudgetType
    importDate?: string | null
    /** "yyyy-MM", or UNDATED_MONTH for the working budget. */
    month: string
    chargeSchedule?: ChargeSchedule | null
}

export function monthlyAmount(item: BudgetItem): number {
    return item.amount * monthlyMultiplier(item.frequency)
}

export function isSubscription(item: BudgetItem): boolean {
    return Boolean(item.chargeSchedule)
}

/**
 * What a goal is counting. Saving is the original: money put aside by hand.
 * Spending and income are read from a linked bank — a ceiling on what goes
 * out, a target for what comes in.
 */
export type GoalKind = "saving" | "spending" | "income"

export function goalKindTitle(kind: GoalKind): string {
    return kind === "saving" ? "Saving" : kind === "spending" ? "Spending" : "Income"
}

/** "40% spent" — a spending goal that says "saved" reads like praise for overspending. */
export function goalProgressVerb(kind: GoalKind): string {
    return kind === "saving" ? "saved" : kind === "spending" ? "spent" : "earned"
}

export type SavingsGoal = {
    id: string
    name: string
    targetAmount: number
    currentAmount: number
    /** ISO yyyy-MM-dd */
    targetDate: string
    monthlyContribution: number
    budgetType: BudgetType
    /** null = follow the name-derived suggestion, so renaming keeps re-suggesting. */
    emoji?: string | null
    /** RRGGBB; null = the theme's positive green. */
    ringColorHex?: string | null
    kind: GoalKind
    /** Which connected accounts count. Empty = every connected account. */
    accountIDs: string[]
    /** Spending/income only: the single category measured. null = every one. */
    category?: string | null
    /** Spending/income counted by hand rather than read from a bank. */
    manualOnly: boolean
    /** Progress alerts the user asked for, as percents (50/75/90/100). */
    alerts: number[]
    alertsFired: number[]
}

export type BudgetHistoryEntry = {
    id: string
    name: string
    startDate: string
    endDate: string
    budgetItems: BudgetItem[]
    monthlyIncome: number
    monthlyExpenses: number
    monthlyNet: number
    budgetType: BudgetType
}

export type CategorySlice = { name: string; value: number }

/** Category options, per budget type. */
export const BUDGET_CATEGORIES = {
    income: {
        personal: ["Salary", "Freelance", "Investments", "Gift", "Other"],
        business: [
            "Sales Revenue",
            "Service Revenue",
            "Subscriptions",
            "Interest Earned",
            "Other Fees",
            "Total Revenue",
            "Other Revenue",
        ],
    },
    expense: {
        personal: [
            "Housing",
            "Utilities",
            "Food",
            "Transportation",
            "Entertainment",
            "Healthcare",
            "Insurance",
            "Debt Payments",
            "Savings",
            "Retirement",
            "Other",
        ],
        business: [
            "Cost of Goods Sold (COGS)",
            "Salaries/Wages",
            "Marketing & Advertising",
            "Rent/Lease",
            "Utilities",
            "Software & Subscriptions",
            "Supplies",
            "Repairs & Maintenance",
            "Insurance",
            "Professional Fees",
            "Taxes",
            "Travel",
            "Depreciation",
            "Loan Payments",
            "Other Operating Costs",
        ],
    },
} as const

export function categoriesFor(type: ItemType, budgetType: BudgetType): readonly string[] {
    return BUDGET_CATEGORIES[type][budgetType]
}

// MARK: - Month slots

/**
 * The slot a budget lives in before it's been given a date — the editor's
 * default working budget. Deliberately not a "yyyy-MM" key, so it survives
 * reloads instead of being swept into the current month.
 */
export const UNDATED_MONTH = "undated"

export function currentMonthKey(now = new Date()): string {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

/** True for a real "yyyy-MM" slot — a budget saved to a month. */
export function isDatedMonth(key: string): boolean {
    return key !== UNDATED_MONTH && key !== ""
}

/** "2026-07" → "July 2026" (echoes the key if it doesn't parse). */
export function monthDisplayName(key: string): string {
    const match = /^(\d{4})-(\d{2})$/.exec(key)
    if (!match) return key
    const date = new Date(Number(match[1]), Number(match[2]) - 1, 1)
    return date.toLocaleDateString(undefined, { month: "long", year: "numeric" })
}

/** The month key `offset` months away from `key`. */
export function monthKeyOffset(key: string, offset: number): string {
    const match = /^(\d{4})-(\d{2})$/.exec(key)
    if (!match) return key
    const date = new Date(Number(match[1]), Number(match[2]) - 1 + offset, 1)
    return currentMonthKey(date)
}

export function todayISO(now = new Date()): string {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate()
    ).padStart(2, "0")}`
}
