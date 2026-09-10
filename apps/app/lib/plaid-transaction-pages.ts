import type { TransactionsGetResponse } from "plaid"

type Page = Pick<TransactionsGetResponse, "transactions" | "accounts" | "total_transactions">

/** Return one complete institution history, or fail without publishing a partial balance. */
export async function readTransactionPages(
    fetchPage: (offset: number, count: number) => Promise<Page>,
): Promise<Page> {
    const transactions: Page["transactions"] = []
    const seen = new Set<string>()
    let accounts: Page["accounts"] = []
    let expected: number | undefined

    do {
        const page = await fetchPage(transactions.length, 250)
        const total = page.total_transactions
        if (!Number.isSafeInteger(total) || total < 0) {
            throw new Error("The bank returned an invalid transaction count. Please refresh again.")
        }
        if (expected !== undefined && total !== expected) {
            throw new Error("The bank's transaction history changed during the refresh. Please try again.")
        }
        if (expected === undefined) accounts = page.accounts
        expected = total
        if (page.transactions.length === 0 && transactions.length < expected) {
            throw new Error("The bank returned an incomplete transaction history. Please refresh again.")
        }
        for (const transaction of page.transactions) {
            if (seen.has(transaction.transaction_id)) {
                throw new Error("The bank's transaction history changed during the refresh. Please try again.")
            }
            seen.add(transaction.transaction_id)
            transactions.push(transaction)
        }
        if (transactions.length > expected) {
            throw new Error("The bank returned an inconsistent transaction count. Please refresh again.")
        }
    } while (transactions.length < expected)

    return { transactions, accounts, total_transactions: expected }
}
