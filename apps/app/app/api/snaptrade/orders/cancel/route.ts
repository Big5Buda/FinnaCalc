import { NextRequest, NextResponse } from "next/server"
import { getSnapTrade, isSnapTradeConfigured, mapOrderRecord, snapTradeErrorMessage } from "@/lib/snaptrade"
import { loadSession } from "@/lib/snaptrade-session"
import { verifiedAppUserId } from "@/lib/supabase-auth"

// Cancels an open order previously placed through the connected brokerage.
export async function POST(req: NextRequest) {
    if (!isSnapTradeConfigured) {
        return NextResponse.json({ error: "Brokerage connection isn't configured." }, { status: 503 })
    }
    // Order mutation requires a signed-in FinnaCalc user, same as place.
    const appUserId = await verifiedAppUserId(req)
    if (!appUserId) {
        return NextResponse.json({ error: "Sign in to FinnaCalc to trade." }, { status: 401 })
    }

    let body: { accountId?: string; brokerageOrderId?: string }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
    }
    const accountId = typeof body.accountId === "string" ? body.accountId.trim() : ""
    const brokerageOrderId = typeof body.brokerageOrderId === "string" ? body.brokerageOrderId.trim() : ""
    if (!accountId || !brokerageOrderId) {
        return NextResponse.json({ error: "accountId and brokerageOrderId are required." }, { status: 400 })
    }

    try {
        const session = await loadSession(appUserId)
        if (!session) {
            return NextResponse.json({ error: "No brokerage connection." }, { status: 401 })
        }
        const st = getSnapTrade()
        const { data } = await st.trading.cancelUserAccountOrder({
            userId: session.userId,
            userSecret: session.userSecret,
            accountId,
            brokerage_order_id: brokerageOrderId,
        })
        return NextResponse.json(mapOrderRecord(data))
    } catch (err: any) {
        return NextResponse.json(
            { error: snapTradeErrorMessage(err, "Failed to cancel the order.") },
            { status: 500 }
        )
    }
}
