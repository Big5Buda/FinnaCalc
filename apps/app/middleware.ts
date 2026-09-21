import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * The auth gate, narrowed to Investing.
 *
 * The site was open from the start: anyone could budget, run the tax
 * estimator, read a lesson or use a calculator, and an account was for
 * keeping that work. #114 put the whole app behind sign-in; the owner asked
 * for the old arrangement back, with one exception he named: Investing,
 * which reads a brokerage and market data that need an account behind them.
 *
 * The signal is the fc_session hint cookie (lib/session-hint.ts), one bit
 * set on sign-in and cleared on sign-out. It is deliberately NOT the session:
 * Supabase's tokens live in this origin's localStorage, which middleware
 * cannot read. So this gate is a door, not a lock; it decides which page
 * shell is served, and the real session check stays in the client's
 * AuthProvider. Forging the cookie gets an anonymous visitor an empty shell
 * with no data behind it.
 *
 * /api is kept out of the matcher entirely: every installed iOS build calls
 * those routes directly and unauthenticated through the www proxy, and
 * gating them bricks shipped apps.
 */

const GATED_PAGES = ["/investing"]

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    if (!GATED_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`))) {
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
    matcher: ["/((?!api|_next|.*\\..*).*)"],
}
