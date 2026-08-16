import { NextResponse } from "next/server"
import { getPlaidClient, isPlaidConfigured } from "@/lib/plaid"

export interface BankTransaction {
    date: string
    name: string
    amount: number // Plaid convention: positive = money out (expense), negative = money in (income)
    category: string // Plaid personal_finance_category primary (e.g. FOOD_AND_DRINK)
    currency: string
}

export async function POST(req: Request) {
    if (!isPlaidConfigured()) {
        return NextResponse.json(
            { error: "Bank connection is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to your environment variables." },
            { status: 503 }
        )
    }

    let body: { public_token?: string }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
    }
    if (!body.public_token) {
        return NextResponse.json({ error: "public_token is required." }, { status: 400 })
    }

    try {
        const client = getPlaidClient()

        const exchange = await client.itemPublicTokenExchange({ public_token: body.public_token })
        const accessToken = exchange.data.access_token

        // Last 90 days of transactions.
        const now = new Date()
        const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        const fmt = (d: Date) => d.toISOString().split("T")[0]

        const { data } = await client.transactionsGet({
            access_token: accessToken,
            start_date: fmt(start),
            end_date: fmt(now),
            options: { count: 250, offset: 0 },
        })

        const transactions: BankTransaction[] = (data.transactions ?? []).map((t: any) => ({
            date: t.date,
            name: t.merchant_name || t.name || "Transaction",
            amount: t.amount,
            category: t.personal_finance_category?.primary || (Array.isArray(t.category) ? t.category[0] : "") || "OTHER",
            currency: t.iso_currency_code || "USD",
        }))

        return NextResponse.json({ transactions })
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
