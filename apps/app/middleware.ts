import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { websiteReview } from "./lib/website-review"

/**
 * Public Investing research and browser-local manual trackers. Authenticated
 * brokerage pages remain preserved in code; brokerage APIs verify identity.
 * Set FINNACALC_REQUIRE_INVESTING_SIGN_IN=true to restore the original
 * Investing-wide page gate once the owner wants it back. Public access is
 * limited to the explicit research routes below; new routes stay gated.
 *
 * The signal is the fc_session hint cookie (lib/session-hint.ts), one bit
 * set on sign-in and cleared on sign-out. It is deliberately NOT the session:
 * Supabase's tokens live in this origin's localStorage, which middleware
 * cannot read. So this gate is a door, not a lock; it decides which page
 * shell is served. Private APIs verify Supabase identity on the server;
 * the client's AuthProvider supplies the browser's signed-in context.
 * Forging the hint does not grant access to brokerage data.
 *
 * /api is kept out of the matcher entirely: every installed iOS build calls
 * those routes directly and unauthenticated through the www proxy, and
 * gating them bricks shipped apps.
 */

const GATED_PAGES = ["/investing"]

const PUBLIC_INVESTING_PAGES = new Set([
    "/investing",
    "/investing/screener",
    "/investing/etfs",
    "/investing/cash-options",
    "/investing/bonds",
    "/investing/tracker",
    "/investing/research",
])

function isPublicInvestingResearch(pathname: string) {
    const path = pathname.replace(/\/$/, "")
    const manual = websiteReview.manualPortfolio && ["/investing/portfolio", "/investing/portfolio/analysis", "/investing/watchlist"].includes(path)
    return manual || PUBLIC_INVESTING_PAGES.has(path) ||
        /^\/investing\/(?:stocks|sectors|tracker)\/[^/]+$/.test(path)
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    if (!GATED_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`))) {
        return NextResponse.next()
    }

    if (process.env.FINNACALC_REQUIRE_INVESTING_SIGN_IN !== "true" && isPublicInvestingResearch(pathname)) {
        return NextResponse.next()
    }

    if (request.cookies.has("fc_session")) {
        return NextResponse.next()
    }

    const signIn = request.nextUrl.clone()
    signIn.pathname = "/sign-in"
    signIn.search = `?next=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(signIn)
}

export const config = {
    // Everything except: API routes (iOS lifeline — must never redirect),
    // Next internals, and files with an extension (icons, images, fonts).
    // Investing also includes ticker symbols containing dots, such as BRK.B.
    matcher: ["/investing/:path*", "/((?!api|_next|.*\\..*).*)"],
}
