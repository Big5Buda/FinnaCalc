import { NextRequest, NextResponse } from "next/server"
import { getSnapTrade, isSnapTradeConfigured, mapOrderRecord, snapTradeErrorMessage } from "@/lib/snaptrade"
import { loadSession } from "@/lib/snaptrade-session"
import { verifiedAppUserId } from "@/lib/supabase-auth"

// Step 2 of the two-step order flow: execute a trade previously validated by
// /api/snaptrade/trade/impact. The tradeId is the only input — the order's
// terms are already locked to what the user reviewed, so nothing about the
// trade can be altered between Review and Confirm.
export async function POST(req: NextRequest) {
    if (!isSnapTradeConfigured) {
        return NextResponse.json({ error: "Brokerage connection isn't configured." }, { status: 503 })
    }
    // Trading requires a signed-in FinnaCalc user — SnapTrade credentials
    // live server-side keyed to the Supabase user, never on the client.
    const appUserId = await verifiedAppUserId(req)
    if (!appUserId) {
        return NextResponse.json({ error: "Sign in to FinnaCalc to trade." }, { status: 401 })
    }

    let body: { tradeId?: string }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
    }
    const tradeId = typeof body.tradeId === "string" ? body.tradeId.trim() : ""
    if (!tradeId) {
        return NextResponse.json({ error: "tradeId is required." }, { status: 400 })
    }

    try {
        const session = await loadSession(appUserId)
        if (!session) {
            return NextResponse.json({ error: "No brokerage connection." }, { status: 401 })
        }
        const st = getSnapTrade()
        const { data } = await st.trading.placeOrder({
            tradeId,
            userId: session.userId,
            userSecret: session.userSecret,
            // Wait for the brokerage to confirm so the response carries a real
            // status (EXECUTED/ACCEPTED/…) instead of an optimistic PENDING.
            wait_to_confirm: true,
        })
        return NextResponse.json(mapOrderRecord(data))
    } catch (err: any) {
        return NextResponse.json(
            { error: snapTradeErrorMessage(err, "The brokerage rejected this order.") },
            { status: 500 }
        )
    }
}
