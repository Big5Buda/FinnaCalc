import { NextRequest, NextResponse } from "next/server"
import { getSnapTrade, isSnapTradeConfigured, mapOrderRecord, snapTradeErrorMessage } from "@/lib/snaptrade"
import { loadSession } from "@/lib/snaptrade-session"
import { verifiedAppUserId } from "@/lib/supabase-auth"

// Recent orders (open + executed) for one connected account.
export async function GET(req: NextRequest) {
    if (!isSnapTradeConfigured) {
        return NextResponse.json({ error: "Brokerage connection isn't configured." }, { status: 503 })
    }
    const appUserId = await verifiedAppUserId(req)
    if (!appUserId) {
        return NextResponse.json({ error: "Sign in to view your brokerage." }, { status: 401 })
    }

    const accountId = req.nextUrl.searchParams.get("accountId")?.trim() ?? ""
    if (!accountId) {
        return NextResponse.json({ error: "accountId is required." }, { status: 400 })
    }
    const daysParam = parseInt(req.nextUrl.searchParams.get("days") ?? "", 10)
    const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 365) : 30

    try {
        const session = await loadSession(appUserId)
        if (!session) {
            return NextResponse.json({ error: "No brokerage connection." }, { status: 401 })
        }
        const st = getSnapTrade()
        const { data } = await st.accountInformation.getUserAccountOrders({
            userId: session.userId,
            userSecret: session.userSecret,
            accountId,
            state: "all",
            days,
        })
        // Tag each order with its accountId so the client can cancel it
        // (cancel needs accountId + brokerageOrderId).
        const orders = (Array.isArray(data) ? data : []).map((o: any) => ({
            ...mapOrderRecord(o),
            accountId,
        }))
        return NextResponse.json({ orders })
    } catch (err: any) {
        return NextResponse.json(
            { error: snapTradeErrorMessage(err, "Failed to load orders.") },
            { status: 500 }
        )
    }
}
