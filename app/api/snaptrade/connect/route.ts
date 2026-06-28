import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import {
    getSnapTrade,
    isSnapTradeConfigured,
    parseSession,
    snapTradeErrorMessage,
    SNAPTRADE_COOKIE,
    type SnapTradeSession,
} from "@/lib/snaptrade"

// Registers the user with SnapTrade if needed, then returns a one-time
// connection-portal URL where the user picks and links their brokerage.
export async function POST(req: NextRequest) {
    if (!isSnapTradeConfigured) {
        return NextResponse.json(
            { error: "Brokerage connection isn't configured. Add SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY." },
            { status: 503 }
        )
    }

    try {
        const st = getSnapTrade()

        let session = parseSession(req.cookies.get(SNAPTRADE_COOKIE)?.value)
        let isNew = false
        if (!session) {
            const userId = `finnacalc-${randomUUID()}`
            const reg = await st.authentication.registerSnapTradeUser({ userId })
            session = { userId: reg.data.userId as string, userSecret: reg.data.userSecret as string }
            isNew = true
        }

        const origin = new URL(req.url).origin
        const login = await st.authentication.loginSnapTradeUser({
            userId: session.userId,
            userSecret: session.userSecret,
            // Establish a trading connection where the brokerage supports it,
            // otherwise fall back to read-only automatically.
            connectionType: "trade-if-available" as any,
            customRedirect: `${origin}/investing`,
        })

        const redirectURI = (login.data as any)?.redirectURI
        if (!redirectURI) throw new Error("Could not generate a connection link.")

        const res = NextResponse.json({ redirectURI })
        if (isNew) {
            res.cookies.set(SNAPTRADE_COOKIE, JSON.stringify(session as SnapTradeSession), {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
                maxAge: 60 * 60 * 24 * 365,
            })
        }
        return res
    } catch (err: any) {
        return NextResponse.json(
            { error: snapTradeErrorMessage(err, "Failed to start the brokerage connection.") },
            { status: 500 }
        )
    }
}
