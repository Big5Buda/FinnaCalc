"use client"

import { useCallback, useState } from "react"
import { usePlaidLink } from "react-plaid-link"
import { Landmark, Loader2 } from "lucide-react"
import { ApiError, apiPost } from "@/lib/api-client"
import { plaidCategory } from "@/lib/budget/categorizer"
import { currentMonthKey, type BudgetItem, type BudgetType, type ItemType } from "@/lib/budget/types"
import { Button, Notice } from "@/components/ui/primitives"

/**
 * Bank connection via Plaid Link, on the same /api/plaid routes the app uses.
 *
 * Imported transactions land as a HISTORY SNAPSHOT, never straight into the
 * live budget — the app does the same (BudgetStore.importPlaidTransactions), so
 * an import can't silently overwrite a budget someone typed by hand. From
 * History they can be imported into the working budget deliberately.
 *
 * Plaid's convention: positive amount = money out (expense), negative = money in.
 */
export function PlaidConnect({
    budgetType,
    onImported,
}: {
    budgetType: BudgetType
    onImported: (args: { items: BudgetItem[]; start: string; end: string }) => void
}) {
    const [linkToken, setLinkToken] = useState<string | null>(null)
    const [status, setStatus] = useState<"idle" | "starting" | "importing">("idle")
    const [error, setError] = useState<string | null>(null)

    const onSuccess = useCallback(
        async (publicToken: string) => {
            setStatus("importing")
            setError(null)
            try {
                const { transactions } = await apiPost<{
                    transactions: { date: string; name: string; amount: number; category: string }[]
                }>("/api/plaid/transactions", { public_token: publicToken })

                const items: BudgetItem[] = transactions.map((txn) => {
                    const type: ItemType = txn.amount > 0 ? "expense" : "income"
                    return {
                        id: crypto.randomUUID(),
                        category: plaidCategory(txn.category, type, budgetType),
                        subcategory: txn.name,
                        amount: Math.abs(txn.amount),
                        frequency: "monthly",
                        type,
                        isFixed: false,
                        budgetType,
                        importDate: txn.date,
                        month: currentMonthKey(),
                    }
                })

                const dates = transactions.map((txn) => txn.date).sort()
                onImported({ items, start: dates[0] ?? "", end: dates[dates.length - 1] ?? "" })
            } catch (err) {
                setError(err instanceof ApiError ? err.message : "Couldn't read those transactions.")
            }
            setStatus("idle")
            setLinkToken(null)
        },
        [budgetType, onImported]
    )

    const { open, ready } = usePlaidLink({
        token: linkToken,
        onSuccess: (publicToken) => void onSuccess(publicToken),
        onExit: () => {
            setStatus("idle")
            setLinkToken(null)
        },
    })

    async function start() {
        setStatus("starting")
        setError(null)
        try {
            const { link_token } = await apiPost<{ link_token: string }>("/api/plaid/create-link-token", {
                product: "transactions",
            })
            setLinkToken(link_token)
        } catch (err) {
            setError(
                err instanceof ApiError && err.notConfigured
                    ? "Bank connection isn't set up on this deployment yet."
                    : err instanceof Error
                      ? err.message
                      : "Couldn't start the bank connection."
            )
            setStatus("idle")
        }
    }

    // The Link handler is only ready once the token lands; open it then.
    if (linkToken && ready && status !== "importing") {
        open()
    }

    return (
        <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={start} disabled={status !== "idle"}>
                {status === "idle" ? (
                    <Landmark className="h-4 w-4" />
                ) : (
                    <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {status === "importing" ? "Importing…" : "Connect a bank"}
            </Button>
            {error && <Notice tone="error">{error}</Notice>}
            <p className="text-xs text-muted-foreground">
                Your bank credentials go to Plaid directly and never touch FinnaCalc. Transactions land in
                History as a snapshot, and stay on this device.
            </p>
        </div>
    )
}
