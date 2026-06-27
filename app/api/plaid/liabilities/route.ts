import { NextResponse } from "next/server"
import { getPlaidClient, isPlaidConfigured } from "@/lib/plaid"

export interface CreditLine {
    accountId: string
    name: string
    mask: string | null
    balance: number
    limit: number | null
    utilization: number | null // % of limit used
    apr: number | null // purchase APR %
    minimumPayment: number | null
    lastStatementBalance: number | null
    nextDueDate: string | null
    isOverdue: boolean
}

export interface OtherDebt {
    accountId: string
    type: "student" | "mortgage"
    name: string
    balance: number
    apr: number | null
    minimumPayment: number | null
    nextDueDate: string | null
}

export interface LiabilitiesResponse {
    creditLines: CreditLine[]
    otherDebts: OtherDebt[]
    totalCreditBalance: number
    totalCreditLimit: number
    overallUtilization: number | null
    totalMinimumPayments: number
    totalDebt: number
    currency: string
}

function round2(n: number) {
    return Math.round(n * 100) / 100
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

        const { data } = await client.liabilitiesGet({ access_token: accessToken })
        const { accounts, liabilities } = data
        const accountById = new Map(accounts.map((a) => [a.account_id, a]))

        const currency = accounts[0]?.balances?.iso_currency_code || "USD"

        // ── Credit cards (the source of credit utilization) ──
        const creditLines: CreditLine[] = (liabilities.credit ?? []).map((c: any) => {
            const acct = c.account_id ? accountById.get(c.account_id) : undefined
            const balance = acct?.balances?.current ?? c.last_statement_balance ?? 0
            const limit = acct?.balances?.limit ?? null
            const utilization = limit && limit > 0 ? round2((balance / limit) * 100) : null
            const aprs = c.aprs ?? []
            const purchase = aprs.find((a: any) => a.apr_type === "purchase_apr") ?? aprs[0]
            return {
                accountId: c.account_id ?? "",
                name: acct?.name ?? acct?.official_name ?? "Credit card",
                mask: acct?.mask ?? null,
                balance: round2(balance),
                limit: limit != null ? round2(limit) : null,
                utilization,
                apr: purchase?.apr_percentage ?? null,
                minimumPayment: c.minimum_payment_amount ?? null,
                lastStatementBalance: c.last_statement_balance ?? null,
                nextDueDate: c.next_payment_due_date ?? null,
                isOverdue: Boolean(c.is_overdue),
            }
        })

        // ── Student loans & mortgages (shown as "other debt") ──
        const otherDebts: OtherDebt[] = []
        for (const s of liabilities.student ?? []) {
            const acct = s.account_id ? accountById.get(s.account_id) : undefined
            otherDebts.push({
                accountId: s.account_id ?? "",
                type: "student",
                name: acct?.name ?? "Student loan",
                balance: round2(acct?.balances?.current ?? 0),
                apr: s.interest_rate_percentage ?? null,
                minimumPayment: s.minimum_payment_amount ?? null,
                nextDueDate: s.next_payment_due_date ?? null,
            })
        }
        for (const m of liabilities.mortgage ?? []) {
            const acct = m.account_id ? accountById.get(m.account_id) : undefined
            otherDebts.push({
                accountId: m.account_id ?? "",
                type: "mortgage",
                name: acct?.name ?? "Mortgage",
                balance: round2(acct?.balances?.current ?? 0),
                apr: m.interest_rate?.percentage ?? null,
                minimumPayment: m.next_monthly_payment ?? null,
                nextDueDate: m.next_payment_due_date ?? null,
            })
        }

        const totalCreditBalance = round2(creditLines.reduce((s, c) => s + c.balance, 0))
        const totalCreditLimit = round2(creditLines.reduce((s, c) => s + (c.limit ?? 0), 0))
        const overallUtilization =
            totalCreditLimit > 0 ? round2((totalCreditBalance / totalCreditLimit) * 100) : null
        const totalMinimumPayments = round2(
            creditLines.reduce((s, c) => s + (c.minimumPayment ?? 0), 0) +
                otherDebts.reduce((s, d) => s + (d.minimumPayment ?? 0), 0)
        )
        const totalDebt = round2(totalCreditBalance + otherDebts.reduce((s, d) => s + d.balance, 0))

        const result: LiabilitiesResponse = {
            creditLines,
            otherDebts,
            totalCreditBalance,
            totalCreditLimit,
            overallUtilization,
            totalMinimumPayments,
            totalDebt,
            currency,
        }
        return NextResponse.json(result)
    } catch (err: any) {
        const message =
            err?.response?.data?.error_message || err?.message || "Failed to load your debts."
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
