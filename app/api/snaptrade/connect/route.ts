import { NextRequest, NextResponse } from "next/server"
import { clearLegacySnapTradeCookie, getSnapTrade, isSnapTradeConfigured, snapTradeErrorMessage } from "@/lib/snaptrade"
import { resolveOrCreateSession } from "@/lib/snaptrade-session"
import { verifiedAppUserId } from "@/lib/supabase-auth"

// Registers the user with SnapTrade if needed, then returns a one-time
// connection-portal URL where the user picks and links their brokerage.
// Requires a signed-in FinnaCalc user: SnapTrade credentials live server-side
// keyed to the Supabase user (lib/snaptrade-session.ts), never on the client.
export async function POST(req: NextRequest) {
    if (!isSnapTradeConfigured) {
        return NextResponse.json(
            { error: "Brokerage connection isn't configured. Add SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY." },
            { status: 503 }
        )
    }
    const appUserId = await verifiedAppUserId(req)
    if (!appUserId) {
        return NextResponse.json({ error: "Sign in to connect a brokerage." }, { status: 401 })
    }

    try {
        const st = getSnapTrade()
        const session = await resolveOrCreateSession(appUserId)

        // The iOS app posts { platform: "ios" } so the portal redirects back
        // into the app's own callback scheme instead of the marketing site —
        // otherwise the native app was left showing this website post-connect.
        let platform: string | undefined
        try {
            const body = await req.json()
            platform = body?.platform
        } catch {
            // No body (the web client posts none) — falls through to the web redirect.
        }

        const origin = new URL(req.url).origin
        const customRedirect = platform === "ios" ? "finnacalc://snaptrade-callback" : `${origin}/investing`

        const login = await st.authentication.loginSnapTradeUser({
            userId: session.userId,
            userSecret: session.userSecret,
            // Trading is approved on this SnapTrade account: request a trading
            // connection where the brokerage supports it, read-only otherwise.
            // NOTE: connections made while this was "read" stay read-only —
            // those users must disconnect and reconnect to grant trading.
            connectionType: "trade-if-available",
            customRedirect,
        })

        const redirectURI = (login.data as any)?.redirectURI
        if (!redirectURI) throw new Error("Could not generate a connection link.")

        const res = NextResponse.json({ redirectURI })
        clearLegacySnapTradeCookie(res)
        return res
    } catch (err: any) {
        return NextResponse.json(
            { error: snapTradeErrorMessage(err, "Failed to start the brokerage connection.") },
            { status: 500 }
        )
    }
}
