import { NextRequest, NextResponse } from "next/server"
import { clearLegacySnapTradeCookie, getSnapTrade, isSnapTradeConfigured } from "@/lib/snaptrade"
import { deleteSession, loadSession } from "@/lib/snaptrade-session"
import { verifiedAppUserId } from "@/lib/supabase-auth"

// Disconnects the user's brokerage: deletes the SnapTrade user (tearing down
// its connections — SnapTrade bills per connected user, so orphaned users
// would keep costing money) and removes the stored credentials.
export async function POST(req: NextRequest) {
    const appUserId = await verifiedAppUserId(req)
    if (!appUserId) {
        // A revocation endpoint failing silently would tell the client
        // "disconnected" while credentials and trading authority stay live
        // server-side — surface it so the UI shows an error instead.
        const res = NextResponse.json({ error: "Sign in to disconnect your brokerage." }, { status: 401 })
        clearLegacySnapTradeCookie(res)
        return res
    }

    try {
        const session = await loadSession(appUserId)
        if (session && !isSnapTradeConfigured) {
            return NextResponse.json({ error: "Brokerage disconnection is temporarily unavailable. Please try again or contact support." }, { status: 503 })
        }
        if (session) {
            // Keep credentials on failure so revocation can be retried. Losing
            // them would orphan a live brokerage authorization and vendor bill.
            try {
                await getSnapTrade().authentication.deleteSnapTradeUser({ userId: session.userId })
            } catch (error: any) {
                // A previous successful vendor deletion followed by a database
                // failure must remain retryable.
                if (error?.response?.status !== 404) throw error
            }
        }
        await deleteSession(appUserId)
    } catch (err) {
        console.error("[/api/snaptrade/disconnect] session teardown failed:", err)
        const res = NextResponse.json({ error: "Failed to disconnect your brokerage." }, { status: 500 })
        clearLegacySnapTradeCookie(res)
        return res
    }

    const res = NextResponse.json({ ok: true })
    clearLegacySnapTradeCookie(res)
    return res
}
