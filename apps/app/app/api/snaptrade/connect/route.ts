import { NextRequest, NextResponse } from "next/server"
import { clearLegacySnapTradeCookie, getSnapTrade, isSnapTradeConfigured, snapTradeErrorMessage } from "@/lib/snaptrade"
import { resolveOrCreateSession } from "@/lib/snaptrade-session"
import { brokerageLimitError, isReadOnlyConnection, listConnections } from "@/lib/snaptrade-access"
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
        const session = await resolveOrCreateSession(appUserId)
        const st = getSnapTrade(session)

        // The iOS app posts { platform: "ios" } so the portal redirects back
        // into the app's own callback scheme instead of the marketing site —
        // otherwise the native app was left showing this website post-connect.
        // { reconnect: <connectionId> } re-auths a specific disabled connection
        // (fix-broken-connections flow) instead of adding a new one.
        // Any `access` field an older client sends is ignored: every link is
        // view-only now, whatever the request asks for.
        let platform: string | undefined
        let reconnect: string | undefined
        let broker: string | undefined
        try {
            const body = await req.json()
            platform = body?.platform
            reconnect = typeof body?.reconnect === "string" && body.reconnect.trim()
                ? body.reconnect.trim()
                : undefined
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

        const connections = await listConnections(session)
        if (reconnect) {
            // Never let a forged reconnect ID bypass the new-connection gate.
            const existing = connections.find((connection) => connection.id === reconnect)
            if (!existing) {
                return NextResponse.json({ error: "That brokerage connection does not belong to this account." }, { status: 404 })
            }
            // Re-authorising reuses the connection's existing grant, so only a
            // link SnapTrade reports as exactly "read" may be repaired. A legacy
            // "trade" link, or one whose type is missing, has to be removed and
            // linked again to become view-only.
            if (!isReadOnlyConnection(existing)) {
                return NextResponse.json({
                    code: "connection_not_read_only",
                    error: "This brokerage link wasn't confirmed as view-only, so FinnaCalc can't reconnect it. Disconnect it, then link your brokerage again for view-only access.",
                }, { status: 409 })
            }
        } else {
            const denied = await brokerageLimitError(appUserId, session, connections, true)
            if (denied) return denied
        }

        const origin = new URL(req.url).origin
        const customRedirect = platform === "ios" ? "finnacalc://snaptrade-callback" : `${origin}/investing`

        const login = await st.authentication.loginSnapTradeUser({
            userId: session.userId,
            userSecret: session.userSecret,
            // FinnaCalc is view-only: every link, new or repaired, asks for
            // read access and nothing else, whatever the client sent.
            connectionType: "read",
            customRedirect,
            immediateRedirect: true,
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
