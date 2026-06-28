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
        const { data } = await st.accountInformation.getAllUserHoldings({
            userId: session.userId,
            userSecret: session.userSecret,
        })
        const holdings = Array.isArray(data) ? data : []

        const accounts: BrokerageAccount[] = holdings.map((h: any) => ({
            id: h.account?.id ?? "",
            name: h.account?.name ?? "Account",
            institution: h.account?.institution_name ?? "Brokerage",
            number: h.account?.number ?? "",
            totalValue: h.total_value?.amount != null ? round2(h.total_value.amount) : null,
            currency: h.total_value?.currency ?? "USD",
        }))

        const positions: BrokeragePosition[] = holdings.flatMap((h: any) =>
            (h.positions ?? []).map((p: any) => {
                const units = p.units ?? 0
                const price = p.price ?? null
                return {
                    accountId: h.account?.id ?? "",
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
