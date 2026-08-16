import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Routing rules for the root domain.
 *
 * The marketing site is public and un-gated, so nothing here guards anything.
 * What it does do is send app paths to the app subdomain: links printed on old
 * material, and anything a search engine indexed before the split, should land
 * a visitor in the right place rather than on a 404.
 */
const APP_PATHS = [
    "/budgeting",
    "/investing",
    "/calculators",
    "/taxes",
    "/education",
    "/account",
    "/plans",
    "/sign-in",
    "/sign-up",
    "/auth",
]

const APP_ORIGIN =
    process.env.NEXT_PUBLIC_APP_ORIGIN ??
    (process.env.NODE_ENV === "production" ? "https://app.finnacalc.com" : "http://localhost:3001")

export function middleware(request: NextRequest) {
    const { pathname, search } = request.nextUrl
    const belongsToApp = APP_PATHS.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )
    if (!belongsToApp) return NextResponse.next()

    // 307: these move with the deployment topology, not permanently, and a
    // cached 308 would be painful to undo if the split is ever reversed.
    return NextResponse.redirect(new URL(`${pathname}${search}`, APP_ORIGIN), 307)
}

export const config = {
    matcher: [
        "/budgeting/:path*",
        "/investing/:path*",
        "/calculators/:path*",
        "/taxes/:path*",
        "/education/:path*",
        "/account/:path*",
        "/plans/:path*",
        "/sign-in",
        "/sign-up",
        "/auth/:path*",
    ],
}
