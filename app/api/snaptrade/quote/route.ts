import { NextRequest, NextResponse } from "next/server"
import { clearLegacySnapTradeCookie, getSnapTrade, isSnapTradeConfigured, snapTradeErrorMessage } from "@/lib/snaptrade"
import { loadSession } from "@/lib/snaptrade-session"
import { verifiedAppUserId } from "@/lib/supabase-auth"

// Live brokerage quote for one symbol in a connected account — feeds the
// order ticket. Uses the account-level quotes endpoint so the price comes
// from the same brokerage the order would route to.
export async function POST(req: NextRequest) {
    if (!isSnapTradeConfigured) {
        return NextResponse.json({ error: "Brokerage connection isn't configured." }, { status: 503 })
    }
    const appUserId = await verifiedAppUserId(req)
    if (!appUserId) {
        return NextResponse.json({ error: "Sign in to view your brokerage." }, { status: 401 })
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
        const session = await loadSession(appUserId)
        if (!session) {
            return NextResponse.json({ error: "No brokerage connection." }, { status: 401 })
        }
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
        const res = NextResponse.json({
            symbol: q.symbol?.symbol ?? symbol,
            bid: q.bid_price ?? null,
            ask: q.ask_price ?? null,
            last: q.last_trade_price ?? null,
        })
        clearLegacySnapTradeCookie(res)
        return res
    } catch (err: any) {
        return NextResponse.json(
            { error: snapTradeErrorMessage(err, "Failed to fetch a quote.") },
            { status: 500 }
        )
    }
}
