import { NextResponse } from "next/server"
import { SNAPTRADE_COOKIE } from "@/lib/snaptrade"

// Clears the local SnapTrade session cookie (logs the brokerage out of this
// browser). The SnapTrade user record itself is left intact.
export async function POST() {
    const res = NextResponse.json({ ok: true })
    res.cookies.set(SNAPTRADE_COOKIE, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    })
    return res
}
