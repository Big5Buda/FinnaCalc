import { NextRequest, NextResponse } from "next/server"
import { getSnapTrade, isSnapTradeConfigured, snapTradeErrorMessage } from "@/lib/snaptrade"
import { loadSession } from "@/lib/snaptrade-session"
import { verifiedAppUserId } from "@/lib/supabase-auth"

// Triggers a manual holdings sync for the user's active connections.
//
// On the free tier SnapTrade caches holdings and refreshes them once a day, so
// a just-placed order (or fresh paper trade) won't appear in accounts/positions
// until a sync runs. This asks SnapTrade to refresh now; the sync is async, so
// the client should reload accounts a moment later (or on ACCOUNT_HOLDINGS_
// UPDATED webhook). Manual refreshes are rate-limited by SnapTrade, so this is
// a user/post-trade action, not a poll.
export async function POST(req: NextRequest) {
    if (!isSnapTradeConfigured) {
        return NextResponse.json({ error: "Brokerage connection isn't configured." }, { status: 503 })
    }
    const appUserId = await verifiedAppUserId(req)
    if (!appUserId) {
        return NextResponse.json({ error: "Sign in to refresh your brokerage." }, { status: 401 })
    }

    try {
        const session = await loadSession(appUserId)
        if (!session) {
            return NextResponse.json({ error: "No brokerage connection." }, { status: 401 })
        }
        const st = getSnapTrade()
        const { data } = await st.connections.listBrokerageAuthorizations({
            userId: session.userId,
            userSecret: session.userSecret,
        })
        const active = (Array.isArray(data) ? data : []).filter((c: any) => c?.id && !c?.disabled)

        // Refresh each active connection; a single failure shouldn't block the
        // others (and SnapTrade may reject with 429 if refreshed too often).
        const results = await Promise.allSettled(
            active.map((c: any) =>
                st.connections.refreshBrokerageAuthorization({
                    authorizationId: c.id,
                    userId: session.userId,
                    userSecret: session.userSecret,
                })
            )
        )
        const refreshed = results.filter((r) => r.status === "fulfilled").length
        return NextResponse.json({ refreshed, total: active.length })
    } catch (err: any) {
        return NextResponse.json(
            { error: snapTradeErrorMessage(err, "Couldn't refresh your brokerage right now.") },
            { status: 500 }
        )
    }
}
