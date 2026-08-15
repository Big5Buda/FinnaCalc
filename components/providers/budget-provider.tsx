"use client"

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react"
import {
    UNDATED_MONTH,
    currentMonthKey,
    isDatedMonth,
    monthlyAmount,
    type BudgetHistoryEntry,
    type BudgetItem,
    type BudgetType,
    type CategorySlice,
    type ItemType,
    type SavingsGoal,
} from "@/lib/budget/types"
import { isValidCategory, fallbackCategory, categorize } from "@/lib/budget/categorizer"

/**
 * The budget store — the browser twin of the app's BudgetStore.swift, with
 * localStorage where iOS uses UserDefaults. Same storage keys, same shapes, so
 * the two implementations describe the same budget.
 *
 * Everything stays on this device: nothing here is sent to a server, which is
 * what the privacy policy already promises about budgets, goals and history.
 */

const KEYS = {
    items: "finnacalc-budget-items",
    goals: "finnacalc-savings-goals",
    history: "finnacalc-budget-history",
    caps: "finnacalc-category-caps",
    lastSlot: "finnacalc-budget-last-slot",
    budgetType: "finnacalc-budget-type",
}

type BudgetContextValue = {
    /** False until localStorage has been read, so nothing renders a wrong empty state. */
    ready: boolean
    budgetType: BudgetType
    setBudgetType: (type: BudgetType) => void

    items: BudgetItem[]
    goals: SavingsGoal[]
    history: BudgetHistoryEntry[]
    categoryCaps: Record<string, Record<string, number>>

    /** The slot the editor has open — a "yyyy-MM" month or the undated one. */
    slot: string
    setSlot: (slot: string) => void
    /** Months this budget has actually been saved to, newest first. */
    savedMonths: string[]
    savedMonthNets: Record<string, number>

    /** The lines of whatever budget is open, for the active budget type. */
    currentItems: BudgetItem[]
    currentGoals: SavingsGoal[]
    currentHistory: BudgetHistoryEntry[]
    itemsInMonth: (month: string) => BudgetItem[]

    monthlyIncome: number
    monthlyExpenses: number
    monthlyNet: number
    /** null when there's no income or nothing routed to Savings/Retirement. */
    savingsRate: number | null
    /** Business: what share of revenue is left after costs. */
    netProfitMargin: number | null
    expenseByCategory: CategorySlice[]
    incomeByCategory: CategorySlice[]

    addItem: (item: Omit<BudgetItem, "id" | "budgetType"> & { id?: string }) => void
    addItems: (items: BudgetItem[]) => void
    updateItem: (item: BudgetItem) => void
    deleteItem: (id: string) => void
    /** Restamps every line of the open budget from one slot to another. */
    moveItems: (from: string, to: string) => void
    clearMonth: (month: string) => void
    clearBudgetItems: () => void
    clearAll: () => void

    addGoal: (goal: Omit<SavingsGoal, "id" | "budgetType"> & { id?: string }) => void
    updateGoal: (goal: SavingsGoal) => void
    deleteGoal: (id: string) => void
    addFunds: (id: string, amount: number) => void

    cap: (category: string) => number | undefined
    setCap: (category: string, amount: number | null) => void

    saveSnapshot: (args: { name: string; startDate: string; endDate: string; lines?: BudgetItem[] }) => void
    deleteSnapshot: (id: string) => void
    /** A snapshot's lines, re-keyed for the live budget. */
    itemsFromSnapshot: (entry: BudgetHistoryEntry) => BudgetItem[]
    /** Lands imported lines in the undated slot, on top of what's there or in place of it. */
    landImport: (items: BudgetItem[], combine: boolean) => void
}

const BudgetContext = createContext<BudgetContextValue | null>(null)

function read<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") return fallback
    try {
        const raw = window.localStorage.getItem(key)
        return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
        return fallback
    }
}

function write(key: string, value: unknown) {
    try {
        window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
        /* quota or private mode — the session still works, it just won't persist */
    }
}

export function BudgetProvider({ children }: { children: ReactNode }) {
    const [ready, setReady] = useState(false)
    const [budgetType, setBudgetTypeState] = useState<BudgetType>("personal")
    const [items, setItems] = useState<BudgetItem[]>([])
    const [goals, setGoals] = useState<SavingsGoal[]>([])
    const [history, setHistory] = useState<BudgetHistoryEntry[]>([])
    const [categoryCaps, setCategoryCaps] = useState<Record<string, Record<string, number>>>({})
    const [lastOpenSlot, setLastOpenSlot] = useState<Record<string, string>>({})

    useEffect(() => {
        const stored = read<BudgetItem[]>(KEYS.items, [])
        // Items saved before slots existed land in the undated slot, NOT the
        // current month: a date is only ever set by the user picking one.
        setItems(stored.map((item) => (item.month ? item : { ...item, month: UNDATED_MONTH })))
        setGoals(read<SavingsGoal[]>(KEYS.goals, []))
        setHistory(read<BudgetHistoryEntry[]>(KEYS.history, []))
        setCategoryCaps(read<Record<string, Record<string, number>>>(KEYS.caps, {}))
        setLastOpenSlot(read<Record<string, string>>(KEYS.lastSlot, {}))
        setBudgetTypeState(read<BudgetType>(KEYS.budgetType, "personal"))
        setReady(true)
    }, [])

    // Persist after the first read, never before — writing on mount would blank
    // a real budget with the empty initial state.
    useEffect(() => {
        if (ready) write(KEYS.items, items)
    }, [ready, items])
    useEffect(() => {
        if (ready) write(KEYS.goals, goals)
    }, [ready, goals])
    useEffect(() => {
        if (ready) write(KEYS.history, history)
    }, [ready, history])
    useEffect(() => {
        if (ready) write(KEYS.caps, categoryCaps)
    }, [ready, categoryCaps])
    useEffect(() => {
        if (ready) write(KEYS.lastSlot, lastOpenSlot)
    }, [ready, lastOpenSlot])
    useEffect(() => {
        if (ready) write(KEYS.budgetType, budgetType)
    }, [ready, budgetType])

    const itemsInMonth = useCallback(
        (month: string) => items.filter((item) => item.budgetType === budgetType && item.month === month),
        [items, budgetType]
    )

    /**
     * The slot the editor should reopen on: whichever it was last left on. A
     * month whose budget has since been deleted would strand the editor on an
     * empty screen under someone else's date, so that falls back to undated.
     */
    const slot = useMemo(() => {
        const remembered = lastOpenSlot[budgetType] ?? UNDATED_MONTH
        if (!isDatedMonth(remembered)) return UNDATED_MONTH
        return itemsInMonth(remembered).length === 0 ? UNDATED_MONTH : remembered
    }, [lastOpenSlot, budgetType, itemsInMonth])

    const setSlot = useCallback(
        (next: string) => setLastOpenSlot((prev) => ({ ...prev, [budgetType]: next })),
        [budgetType]
    )

    const currentItems = useMemo(() => itemsInMonth(slot), [itemsInMonth, slot])
    const currentGoals = useMemo(
        () => goals.filter((goal) => goal.budgetType === budgetType),
        [goals, budgetType]
    )
    const currentHistory = useMemo(
        () => history.filter((entry) => entry.budgetType === budgetType),
        [history, budgetType]
    )

    const savedMonths = useMemo(() => {
        const seen = new Set<string>()
        for (const item of items) {
            if (item.budgetType === budgetType && isDatedMonth(item.month)) seen.add(item.month)
        }
        return [...seen].sort().reverse()
    }, [items, budgetType])

    const savedMonthNets = useMemo(() => {
        const nets: Record<string, number> = {}
        for (const item of items) {
            if (item.budgetType !== budgetType || !isDatedMonth(item.month)) continue
            const value = monthlyAmount(item)
            nets[item.month] = (nets[item.month] ?? 0) + (item.type === "income" ? value : -value)
        }
        return nets
    }, [items, budgetType])

    const monthlyIncome = useMemo(
        () =>
            currentItems.filter((i) => i.type === "income").reduce((sum, i) => sum + monthlyAmount(i), 0),
        [currentItems]
    )
    const monthlyExpenses = useMemo(
        () =>
            currentItems.filter((i) => i.type === "expense").reduce((sum, i) => sum + monthlyAmount(i), 0),
        [currentItems]
    )
    const monthlyNet = monthlyIncome - monthlyExpenses

    /** Only "Savings"/"Retirement" expense categories count toward savings rate. */
    const savingsRate = useMemo(() => {
        const saved = currentItems
            .filter((i) => i.type === "expense" && (i.category === "Savings" || i.category === "Retirement"))
            .reduce((sum, i) => sum + monthlyAmount(i), 0)
        if (!(monthlyIncome > 0) || !(saved > 0)) return null
        return (saved / monthlyIncome) * 100
    }, [currentItems, monthlyIncome])

    const netProfitMargin = monthlyIncome > 0 ? (monthlyNet / monthlyIncome) * 100 : null

    const grouped = useCallback(
        (type: ItemType): CategorySlice[] => {
            const totals = new Map<string, number>()
            for (const item of currentItems) {
                if (item.type !== type) continue
                totals.set(item.category, (totals.get(item.category) ?? 0) + monthlyAmount(item))
            }
            return [...totals.entries()]
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
        },
        [currentItems]
    )

    const expenseByCategory = useMemo(() => grouped("expense"), [grouped])
    const incomeByCategory = useMemo(() => grouped("income"), [grouped])

    // MARK: Mutations

    const addItem = useCallback<BudgetContextValue["addItem"]>(
        (partial) => {
            const item: BudgetItem = {
                ...partial,
                id: partial.id ?? crypto.randomUUID(),
                budgetType,
                month: partial.month || UNDATED_MONTH,
            }
            setItems((prev) => [...prev, item])
        },
        [budgetType]
    )

    /** Appends a whole import in one mutation, not one re-render per row. */
    const addItems = useCallback((newItems: BudgetItem[]) => {
        if (newItems.length === 0) return
        setItems((prev) => [
            ...prev,
            ...newItems.map((item) => ({ ...item, month: item.month || UNDATED_MONTH })),
        ])
    }, [])

    const updateItem = useCallback((item: BudgetItem) => {
        setItems((prev) => prev.map((existing) => (existing.id === item.id ? item : existing)))
    }, [])

    const deleteItem = useCallback((id: string) => {
        setItems((prev) => prev.filter((item) => item.id !== id))
    }, [])

    const moveItems = useCallback(
        (from: string, to: string) => {
            if (from === to) return
            setItems((prev) =>
                prev.map((item) =>
                    item.budgetType === budgetType && item.month === from ? { ...item, month: to } : item
                )
            )
            setLastOpenSlot((prev) => ({ ...prev, [budgetType]: to }))
        },
        [budgetType]
    )

    const clearMonth = useCallback(
        (month: string) => {
            setItems((prev) =>
                prev.filter((item) => !(item.budgetType === budgetType && item.month === month))
            )
        },
        [budgetType]
    )

    /**
     * Wipes every line of ONE budget, across every month. Goals, history and
     * caps are left alone — they aren't budget lines.
     */
    const clearBudgetItems = useCallback(() => {
        setItems((prev) => prev.filter((item) => item.budgetType !== budgetType))
    }, [budgetType])

    /** Everything belonging to ONE budget: lines, goals, snapshots and caps. */
    const clearAll = useCallback(() => {
        setItems((prev) => prev.filter((item) => item.budgetType !== budgetType))
        setGoals((prev) => prev.filter((goal) => goal.budgetType !== budgetType))
        setHistory((prev) => prev.filter((entry) => entry.budgetType !== budgetType))
        setCategoryCaps((prev) => ({ ...prev, [budgetType]: {} }))
    }, [budgetType])

    const addGoal = useCallback<BudgetContextValue["addGoal"]>(
        (partial) => {
            const goal: SavingsGoal = {
                ...partial,
                id: partial.id ?? crypto.randomUUID(),
                budgetType,
            }
            setGoals((prev) => [...prev, goal])
        },
        [budgetType]
    )

    const updateGoal = useCallback((goal: SavingsGoal) => {
        setGoals((prev) =>
            prev.map((existing) =>
                existing.id === goal.id ? { ...goal, budgetType: existing.budgetType } : existing
            )
        )
    }, [])

    const deleteGoal = useCallback((id: string) => {
        setGoals((prev) => prev.filter((goal) => goal.id !== id))
    }, [])

    const addFunds = useCallback((id: string, amount: number) => {
        setGoals((prev) =>
            prev.map((goal) =>
                goal.id === id ? { ...goal, currentAmount: goal.currentAmount + amount } : goal
            )
        )
    }, [])

    const cap = useCallback(
        (category: string) => categoryCaps[budgetType]?.[category],
        [categoryCaps, budgetType]
    )

    const setCap = useCallback(
        (category: string, amount: number | null) => {
            setCategoryCaps((prev) => {
                const forType = { ...(prev[budgetType] ?? {}) }
                if (amount && amount > 0) forType[category] = amount
                else delete forType[category]
                return { ...prev, [budgetType]: forType }
            })
        },
        [budgetType]
    )

    const saveSnapshot = useCallback<BudgetContextValue["saveSnapshot"]>(
        ({ name, startDate, endDate, lines }) => {
            const captured = lines ?? currentItems
            const income = captured
                .filter((i) => i.type === "income")
                .reduce((sum, i) => sum + monthlyAmount(i), 0)
            const expenses = captured
                .filter((i) => i.type === "expense")
                .reduce((sum, i) => sum + monthlyAmount(i), 0)
            const entry: BudgetHistoryEntry = {
                id: crypto.randomUUID(),
                name,
                startDate,
                endDate,
                budgetItems: captured,
                monthlyIncome: income,
                monthlyExpenses: expenses,
                monthlyNet: income - expenses,
                budgetType,
            }
            setHistory((prev) => [entry, ...prev])
        },
        [currentItems, budgetType]
    )

    const deleteSnapshot = useCallback((id: string) => {
        setHistory((prev) => prev.filter((entry) => entry.id !== id))
    }, [])

    /**
     * A snapshot's lines, re-keyed for the live budget: fresh ids, the undated
     * slot, the active budget type.
     *
     * Two cases get re-categorised from the description: a category this budget
     * doesn't offer (a Personal snapshot opened on Business) would import as a
     * phantom group the list and donut still render, and a catch-all "Other" —
     * what a Plaid snapshot is full of — gets a second chance off the merchant
     * name.
     */
    const itemsFromSnapshot = useCallback(
        (entry: BudgetHistoryEntry): BudgetItem[] =>
            entry.budgetItems.map((saved) => {
                const item: BudgetItem = {
                    ...saved,
                    id: crypto.randomUUID(),
                    month: UNDATED_MONTH,
                    budgetType,
                }
                const valid = isValidCategory(item.category, item.type, budgetType)
                const isCatchAll = item.category === fallbackCategory(item.type, budgetType)
                if ((!valid || isCatchAll) && item.subcategory) {
                    item.category = categorize(item.subcategory, item.type, budgetType)
                } else if (!valid) {
                    item.category = fallbackCategory(item.type, budgetType)
                }
                return item
            }),
        [budgetType]
    )

    const landImport = useCallback(
        (newItems: BudgetItem[], combine: boolean) => {
            setItems((prev) => {
                const kept = combine
                    ? prev
                    : prev.filter(
                          (item) => !(item.budgetType === budgetType && item.month === UNDATED_MONTH)
                      )
                return [...kept, ...newItems.map((item) => ({ ...item, month: item.month || UNDATED_MONTH }))]
            })
            setLastOpenSlot((prev) => ({ ...prev, [budgetType]: UNDATED_MONTH }))
        },
        [budgetType]
    )

    const value = useMemo<BudgetContextValue>(
        () => ({
            ready,
            budgetType,
            setBudgetType: setBudgetTypeState,
            items,
            goals,
            history,
            categoryCaps,
            slot,
            setSlot,
            savedMonths,
            savedMonthNets,
            currentItems,
            currentGoals,
            currentHistory,
            itemsInMonth,
            monthlyIncome,
            monthlyExpenses,
            monthlyNet,
            savingsRate,
            netProfitMargin,
            expenseByCategory,
            incomeByCategory,
            addItem,
            addItems,
            updateItem,
            deleteItem,
            moveItems,
            clearMonth,
            clearBudgetItems,
            clearAll,
            addGoal,
            updateGoal,
            deleteGoal,
            addFunds,
            cap,
            setCap,
            saveSnapshot,
            deleteSnapshot,
            itemsFromSnapshot,
            landImport,
        }),
        [
            ready, budgetType, items, goals, history, categoryCaps, slot, setSlot, savedMonths,
            savedMonthNets, currentItems, currentGoals, currentHistory, itemsInMonth, monthlyIncome,
            monthlyExpenses, monthlyNet, savingsRate, netProfitMargin, expenseByCategory,
            incomeByCategory, addItem, addItems, updateItem, deleteItem, moveItems, clearMonth,
            clearBudgetItems, clearAll, addGoal, updateGoal, deleteGoal, addFunds, cap, setCap,
            saveSnapshot, deleteSnapshot, itemsFromSnapshot, landImport,
        ]
    )

    return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>
}

export function useBudget(): BudgetContextValue {
    const ctx = useContext(BudgetContext)
    if (!ctx) throw new Error("useBudget must be used inside <BudgetProvider>")
    return ctx
}

/** The current month, for callers that need it without importing the types module. */
export { currentMonthKey }
