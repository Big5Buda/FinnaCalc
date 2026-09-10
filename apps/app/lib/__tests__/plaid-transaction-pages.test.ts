import { describe, expect, it, vi } from "vitest"
import type { Transaction, AccountBase } from "plaid"
import { readTransactionPages } from "../plaid-transaction-pages"

const transactions = (start: number, count: number) => Array.from({ length: count }, (_, i) => ({
    transaction_id: String(start + i), date: "2026-09-09", amount: 1,
} as Transaction))
const accounts = [{ account_id: "bank-account" }] as AccountBase[]

describe("complete bank transaction pagination", () => {
    it("loads records beyond the first 250 and keeps balances once", async () => {
        const fetch = vi.fn(async (offset: number) => ({
            accounts, total_transactions: 501,
            transactions: transactions(offset, Math.min(250, 501 - offset)),
        }))
        const result = await readTransactionPages(fetch)
        expect(result.transactions).toHaveLength(501)
        expect(result.accounts).toHaveLength(1)
        expect(fetch.mock.calls.map(call => call[0])).toEqual([0, 250, 500])
    })

    it("keeps accounts with genuinely empty histories", async () => {
        const result = await readTransactionPages(async () => ({
            accounts, total_transactions: 0, transactions: [],
        }))
        expect(result).toEqual({ accounts, total_transactions: 0, transactions: [] })
    })

    it("rejects a failed later page instead of returning partial history", async () => {
        await expect(readTransactionPages(async offset => {
            if (offset) throw new Error("bank unavailable")
            return { accounts, total_transactions: 251, transactions: transactions(0, 250) }
        })).rejects.toThrow("bank unavailable")
    })

    it("rejects a missing page rather than looping or truncating", async () => {
        await expect(readTransactionPages(async () => ({
            accounts, total_transactions: 1, transactions: [],
        }))).rejects.toThrow("incomplete transaction history")
    })

    it("rejects changed totals and overlapping pages", async () => {
        await expect(readTransactionPages(async offset => ({
            accounts, total_transactions: offset ? 252 : 251,
            transactions: transactions(offset, offset ? 2 : 250),
        }))).rejects.toThrow("changed during the refresh")
        await expect(readTransactionPages(async offset => ({
            accounts, total_transactions: 251,
            transactions: transactions(0, offset ? 1 : 250),
        }))).rejects.toThrow("changed during the refresh")
    })
})
