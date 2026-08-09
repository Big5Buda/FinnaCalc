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
        // { reconnect: <connectionId> } re-auths a specific disabled connection
        // (fix-broken-connections flow) instead of adding a new one.
        let platform: string | undefined
        let reconnect: string | undefined
        let access: string | undefined
        let broker: string | undefined
        try {
            const body = await req.json()
            platform = body?.platform
            reconnect = typeof body?.reconnect === "string" && body.reconnect.trim()
                ? body.reconnect.trim()
                : undefined
            access = body?.access
            // Brokerage slug chosen in the app's own picker, so the portal
            // opens on that brokerage's login instead of making the user
            // find it a second time in SnapTrade's list. Uppercased because
            // SnapTrade's slugs are (ROBINHOOD, WEALTHSIMPLE-TRADE); an
            // unknown slug just falls back to the full list.
            broker = typeof body?.broker === "string" && body.broker.trim()
                ? body.broker.trim().toUpperCase()
                : undefined
        } catch {
            // No body (the web client posts none) — falls through to the web redirect.
        }

        const origin = new URL(req.url).origin
        const customRedirect = platform === "ios" ? "finnacalc://snaptrade-callback" : `${origin}/investing`

        const login = await st.authentication.loginSnapTradeUser({
            userId: session.userId,
            userSecret: session.userSecret,
            // The user picks this on the way in: "read" links the account for
            // viewing only, "trade-if-available" also asks the brokerage for
            // permission to place and cancel orders. Anything unrecognised —
            // including an older client that sends nothing — gets read-only,
            // so trading authority is never granted by omission.
            // NOTE: the level is fixed at connect time. Changing it means
            // disconnecting and reconnecting.
            connectionType: access === "trade" ? "trade-if-available" : "read",
            customRedirect,
            // Only set when repairing a disabled connection; the SDK ignores
            // an empty value for a fresh connect.
            ...(reconnect ? { reconnect } : {}),
            // Skips the portal's brokerage list when the app already asked.
            ...(broker ? { broker } : {}),
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
