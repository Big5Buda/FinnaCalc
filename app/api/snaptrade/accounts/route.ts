import { NextRequest, NextResponse } from "next/server"
import {
    getSnapTrade,
    isSnapTradeConfigured,
    parseSession,
    snapTradeErrorMessage,
    SNAPTRADE_COOKIE,
} from "@/lib/snaptrade"

export interface BrokerageAccount {
    id: string
    name: string
    institution: string
    number: string
    totalValue: number | null
    currency: string
}

export interface BrokeragePosition {
    accountId: string
    symbol: string
    description: string
    units: number
    price: number | null
    marketValue: number | null
    openPnl: number | null
}

function round2(n: number) {
    return Math.round(n * 100) / 100
}

export async function GET(req: NextRequest) {
    if (!isSnapTradeConfigured) {
        return NextResponse.json({ configured: false, accounts: [], positions: [] })
    }

    const session = parseSession(req.cookies.get(SNAPTRADE_COOKIE)?.value)
    if (!session) {
        return NextResponse.json({ configured: true, connected: false, accounts: [], positions: [] })
    }

    try {
        const st = getSnapTrade()

        // getAllUserHoldings is deprecated and returns HTTP 410 Gone ("this
        // endpoint is no longer available for your account") for every account
        // created after 2026-04-25. Replaced by listUserAccounts plus a
        // per-account getUserHoldings fetch (the account-specific endpoint).
        const { data: accountData } = await st.accountInformation.listUserAccounts({
            userId: session.userId,
            userSecret: session.userSecret,
        })
        const accountList = Array.isArray(accountData) ? accountData : []

        const accounts: BrokerageAccount[] = accountList.map((a: any) => ({
            id: a.id ?? "",
            name: a.name ?? "Account",
            institution: a.institution_name ?? "Brokerage",
            number: a.number ?? "",
            totalValue: a.balance?.total?.amount != null ? round2(a.balance.total.amount) : null,
            currency: a.balance?.total?.currency ?? "USD",
        }))

        // Positions now come from the per-account holdings endpoint. Fetch all
        // accounts in parallel; a single failing account shouldn't blank the rest.
        const holdingsByAccount = await Promise.all(
            accountList.map(async (a: any) => {
                try {
                    const { data } = await st.accountInformation.getUserHoldings({
                        accountId: a.id,
                        userId: session.userId,
                        userSecret: session.userSecret,
                    })
                    return { accountId: a.id ?? "", positions: data?.positions ?? [] }
                } catch {
                    return { accountId: a.id ?? "", positions: [] }
                }
            })
        )

        const positions: BrokeragePosition[] = holdingsByAccount.flatMap(({ accountId, positions: accountPositions }) =>
            (accountPositions ?? []).map((p: any) => {
                const units = p.units ?? 0
                const price = p.price ?? null
                return {
                    accountId,
                    symbol:
                        p.symbol?.symbol?.symbol ??
                        p.symbol?.symbol?.raw_symbol ??
                        p.symbol?.description ??
                        "—",
                    description: p.symbol?.symbol?.description ?? p.symbol?.description ?? "",
                    units,
                    price: price != null ? round2(price) : null,
                    marketValue: price != null ? round2(units * price) : null,
                    openPnl: p.open_pnl != null ? round2(p.open_pnl) : null,
                }
            })
        )

        const currency = accounts[0]?.currency ?? "USD"
        const totalValue = round2(accounts.reduce((s, a) => s + (a.totalValue ?? 0), 0))

        return NextResponse.json({
            configured: true,
            connected: accounts.length > 0,
            accounts,
            positions,
            totalValue,
            currency,
        })
    } catch (err: any) {
        return NextResponse.json(
            { configured: true, connected: false, accounts: [], positions: [], error: snapTradeErrorMessage(err, "Failed to load brokerage accounts.") },
            { status: 500 }
        )
    }
}
