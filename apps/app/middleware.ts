import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * The auth gate: the app is for signed-in users, and anonymous visitors are
 * sent to sign-in with the page they wanted preserved in ?next=.
 *
 * The signal is the fc_session hint cookie (lib/session-hint.ts) — one bit,
 * set on sign-in, cleared on sign-out. It is deliberately NOT the session:
 * Supabase's tokens live in this origin's localStorage, which middleware
 * cannot read. So this gate is a door, not a lock — it decides which page
 * shell is served, and the real session check stays where it always was, in
 * the client's AuthProvider. Forging the cookie gets an anonymous visitor an
 * empty shell with no data behind it, which is exactly what they could see
 * before the gate existed.
 *
 * What stays open, and why:
 *   /sign-in /sign-up /auth   the way in (PKCE callback + password reset)
 *   /migrate                  moves a visitor's data from the old origin —
 *                             they arrive with data but no account yet
 *   /privacy /terms /about    a person must be able to read what they're
 *                             accepting BEFORE they accept it
 *   /api                      every installed iOS build calls these routes
 *                             directly and unauthenticated (via the www
 *                             proxy). Gating them bricks shipped apps.
 *
 * The matcher keeps middleware entirely off /api and static assets rather
 * than allowlisting them per-request: routes that must never be touched by
 * the gate shouldn't depend on an if-statement staying correct.
 */

const PUBLIC_PAGES = ["/sign-in", "/sign-up", "/auth", "/migrate", "/privacy", "/terms", "/about"]

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    if (PUBLIC_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`))) {
        return NextResponse.next()
    }

    if (request.cookies.has("fc_session")) {
        return NextResponse.next()
    }

    const signIn = request.nextUrl.clone()
    signIn.pathname = "/sign-in"
    signIn.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(signIn)
}

export const config = {
    // Everything except: API routes (iOS lifeline — must never redirect),
    // Next internals, and files with an extension (icons, images, fonts).
    matcher: ["/((?!api|_next|.*\\..*).*)"],
}
