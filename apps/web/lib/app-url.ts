/**
 * Where the authenticated application lives.
 *
 * The marketing site is the root domain; everything a signed-in user does
 * happens on the app subdomain. The URL is configuration, not a constant, so
 * the same build runs against localhost in development and
 * app.finnacalc.com in production.
 */

export const APP_ORIGIN =
    process.env.NEXT_PUBLIC_APP_ORIGIN ??
    (process.env.NODE_ENV === "production" ? "https://app.finnacalc.com" : "http://localhost:3001")

/**
 * The cookie domain a session must be scoped to for the root domain and the
 * app subdomain to share it. Configuration for the same reason: on localhost
 * there is no parent domain to scope to, and setting one there breaks the
 * cookie entirely.
 */
export const SESSION_COOKIE_DOMAIN = process.env.NEXT_PUBLIC_SESSION_COOKIE_DOMAIN ?? undefined

/** A link into the app, preserving where the visitor should land. */
export function appUrl(path = "/", params: Record<string, string> = {}): string {
    const url = new URL(path, APP_ORIGIN)
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
    return url.toString()
}

export function loginUrl(next?: string): string {
    return appUrl("/sign-in", next ? { next } : {})
}

export function signUpUrl(next?: string): string {
    return appUrl("/sign-up", next ? { next } : {})
}
