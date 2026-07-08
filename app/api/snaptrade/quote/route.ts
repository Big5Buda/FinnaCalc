import { NextRequest, NextResponse } from "next/server"
import {
    getSnapTrade,
    isSnapTradeConfigured,
    parseSession,
    snapTradeErrorMessage,
    SNAPTRADE_COOKIE,
} from "@/lib/snaptrade"

// Live brokerage quote for one symbol in a connected account — feeds the
// order ticket. Uses the account-level quotes endpoint so the price comes
// from the same brokerage the order would route to.
export async function POST(req: NextRequest) {
    if (!isSnapTradeConfigured) {
        return NextResponse.json({ error: "Brokerage connection isn't configured." }, { status: 503 })
    }
    const session = parseSession(req.cookies.get(SNAPTRADE_COOKIE)?.value)
    if (!session) {
        return NextResponse.json({ error: "No brokerage connection." }, { status: 401 })
    }

    let body: { accountId?: string; symbol?: string }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
    }
    const accountId = typeof body.accountId === "string" ? body.accountId.trim() : ""
    const symbol = typeof body.symbol === "string" ? body.symbol.trim().toUpperCase() : ""
    if (!accountId || !symbol) {
        return NextResponse.json({ error: "accountId and symbol are required." }, { status: 400 })
    }

    try {
        const st = getSnapTrade()
        const { data } = await st.trading.getUserAccountQuotes({
            userId: session.userId,
            userSecret: session.userSecret,
            accountId,
            symbols: symbol,
            useTicker: true,
        })
        const q: any = Array.isArray(data) ? data[0] : null
        if (!q) {
            return NextResponse.json({ error: `No quote available for ${symbol}.` }, { status: 404 })
        }
        return NextResponse.json({
            symbol: q.symbol?.symbol ?? symbol,
            bid: q.bid_price ?? null,
            ask: q.ask_price ?? null,
            last: q.last_trade_price ?? null,
        })
    } catch (err: any) {
        return NextResponse.json(
            { error: snapTradeErrorMessage(err, "Failed to fetch a quote.") },
            { status: 500 }
        )
    }
}
