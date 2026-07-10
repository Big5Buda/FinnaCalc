import { NextRequest, NextResponse } from "next/server"
import { getSnapTrade, isSnapTradeConfigured, snapTradeErrorMessage } from "@/lib/snaptrade"
import { loadSession } from "@/lib/snaptrade-session"
import { verifiedAppUserId } from "@/lib/supabase-auth"

// Lists the user's brokerage connections with their health, so the app can
// surface a "Reconnect" action for disabled ones (disabled == true means the
// user must re-auth — see the fix-broken-connections flow).
export async function GET(req: NextRequest) {
    if (!isSnapTradeConfigured) {
        return NextResponse.json({ configured: false, connections: [] })
    }
    const appUserId = await verifiedAppUserId(req)
    if (!appUserId) {
        return NextResponse.json({ error: "Sign in to view your brokerage." }, { status: 401 })
    }

    try {
        const session = await loadSession(appUserId)
        if (!session) {
            return NextResponse.json({ configured: true, connections: [] })
        }
        const st = getSnapTrade()
        const { data } = await st.connections.listBrokerageAuthorizations({
            userId: session.userId,
            userSecret: session.userSecret,
        })
        const connections = (Array.isArray(data) ? data : []).map((c: any) => ({
            id: c.id ?? "",
            brokerage: c.brokerage?.name ?? c.name ?? "Brokerage",
            disabled: c.disabled ?? false,
            type: c.type ?? null, // "read" | "trade"
            // Brokerage trading capabilities — the order ticket gates its order
            // modes on these (dollar/notional orders need fractional support).
            allowsTrading: c.brokerage?.allows_trading ?? null,
            allowsFractionalUnits: c.brokerage?.allows_fractional_units ?? null,
        }))
        return NextResponse.json({ configured: true, connections })
    } catch (err: any) {
        return NextResponse.json(
            { error: snapTradeErrorMessage(err, "Failed to load connections.") },
            { status: 500 }
        )
    }
}
