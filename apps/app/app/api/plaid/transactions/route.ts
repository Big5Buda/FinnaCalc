import { NextRequest, NextResponse } from "next/server"
import { getPlaidClient, isPlaidConfigured } from "@/lib/plaid"
import { loadItems, saveItem } from "@/lib/plaid-items"
import { verifiedAppUserId } from "@/lib/supabase-auth"

export interface BankTransaction {
    date: string
    name: string
    amount: number // Plaid convention: positive = money out (expense), negative = money in (income)
    category: string // Plaid personal_finance_category primary (e.g. FOOD_AND_DRINK)
    currency: string
}

/** One linked account, with the balance as of this read. */
export interface BankAccountBalance {
    accountId: string
    name: string
    mask: string | null
    type: string | null
    subtype: string | null
    /** Ledger balance. null when Plaid has none for the account type. */
    current: number | null
    /** Spendable now — differs from `current` by pending activity. */
    available: number | null
    currency: string
}

/**
 * Transactions and balances for the caller's linked banks.
 *
 * Two ways in:
 *   · with `public_token` — a brand-new link. The token is exchanged and the
 *     resulting access_token is STORED (lib/plaid-items) so this connection
 *     can be re-read later.
 *   · with no body — refresh. Reads every stored item for this user.
 *
 * Balances ride along on the same transactionsGet response Plaid already
 * returns, so a refresh costs one call per institution, not two.
 *
 * Auth is required now that tokens are persisted per user: the caller is
 * resolved from their Supabase token and never from anything they send.
 */
export async function POST(req: NextRequest) {
    if (!isPlaidConfigured()) {
        return NextResponse.json(
            { error: "Bank connection is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to your environment variables." },
            { status: 503 }
        )
    }

    const appUserId = await verifiedAppUserId(req)
    if (!appUserId) {
        return NextResponse.json({ error: "Sign in to connect a bank." }, { status: 401 })
    }

    // No body at all is the refresh case, so a parse failure isn't an error.
    let body: { public_token?: string; institution?: string } = {}
    try {
        body = await req.json()
    } catch {
        body = {}
    }

    try {
        const client = getPlaidClient()

        // A public_token means a new link: exchange it and keep the result, so
        // this institution can be read again without another trip through
        // Plaid Link.
        if (body.public_token) {
            const exchange = await client.itemPublicTokenExchange({ public_token: body.public_token })
            await saveItem(appUserId, {
                itemId: exchange.data.item_id,
                accessToken: exchange.data.access_token,
                institution: body.institution ?? null,
            })
        }

        const items = await loadItems(appUserId)
        if (items.length === 0) {
            return NextResponse.json({ transactions: [], accounts: [], asOf: new Date().toISOString() })
        }

        // Last 90 days of transactions.
        const now = new Date()
        const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        const fmt = (d: Date) => d.toISOString().split("T")[0]

        const transactions: BankTransaction[] = []
        const accounts: BankAccountBalance[] = []
        const failures: string[] = []

        for (const item of items) {
            try {
                const { data } = await client.transactionsGet({
                    access_token: item.accessToken,
                    start_date: fmt(start),
                    end_date: fmt(now),
                    options: { count: 250, offset: 0 },
                })

                for (const t of data.transactions ?? []) {
                    transactions.push({
                        date: t.date,
                        name: t.merchant_name || t.name || "Transaction",
                        amount: t.amount,
                        category:
                            (t as any).personal_finance_category?.primary ||
                            (Array.isArray(t.category) ? t.category[0] : "") ||
                            "OTHER",
                        currency: t.iso_currency_code || "USD",
                    })
                }

                // Balances come back on this same response — no second call.
                for (const a of data.accounts ?? []) {
                    accounts.push({
                        accountId: a.account_id,
                        name: a.official_name || a.name || "Account",
                        mask: a.mask ?? null,
                        type: (a.type as string) ?? null,
                        subtype: (a.subtype as string) ?? null,
                        current: a.balances?.current ?? null,
                        available: a.balances?.available ?? null,
                        currency: a.balances?.iso_currency_code || "USD",
                    })
                }
            } catch (err: any) {
                // One dead institution must not blank the others. Its name
                // goes back so the app can say which needs reconnecting
                // rather than silently dropping a bank's worth of money.
                failures.push(item.institution || "A bank")
            }
        }

        if (accounts.length === 0 && failures.length > 0) {
            return NextResponse.json(
                { error: `${failures.join(", ")} needs reconnecting.`, transactions: [], accounts: [] },
                { status: 502 }
            )
        }

        return NextResponse.json({
            transactions,
            accounts,
            asOf: new Date().toISOString(),
            ...(failures.length > 0 ? { staleInstitutions: failures } : {}),
        })
    } catch (err: any) {
        const message =
            err?.response?.data?.error_message || err?.message || "Failed to load transactions."
        // Transactions can take a moment to be ready right after linking.
        const isNotReady = err?.response?.data?.error_code === "PRODUCT_NOT_READY"
        return NextResponse.json(
            { error: isNotReady ? "Your transactions are still syncing — please try again in a few seconds." : message },
            { status: 500 }
        )
    }
}
