/**
 * Where the authenticated application lives.
 *
 * The marketing site is the root domain; everything a signed-in user does
 * happens on the app subdomain. The URL is configuration, not a constant, so
 * the same build runs against localhost in development and
 * app.finnacalc.com in production.
 *
 * That configuration is treated as untrusted input, because it is: an env var
 * can arrive empty, without a protocol, or with a stray trailing slash, and
 * `new URL()` throws on all three. It throws at build time too — every page
 * renders the nav and footer, which link into the app — so one malformed
 * variable took down the whole static export, `/_not-found` included. Nothing
 * here throws now: a value that can't be parsed falls back to the documented
 * default.
 */

const PRODUCTION_DEFAULT = "https://app.finnacalc.com"
const DEVELOPMENT_DEFAULT = "http://localhost:3001"

function defaultOrigin(): string {
    return process.env.NODE_ENV === "production" ? PRODUCTION_DEFAULT : DEVELOPMENT_DEFAULT
}

/** Treats blank and whitespace-only values as absent — `??` does not. */
function configured(name: string): string | undefined {
    const raw = process.env[name]
    if (typeof raw !== "string") return undefined
    const trimmed = raw.trim()
    return trimmed === "" ? undefined : trimmed
}

/**
 * A parseable absolute origin, or null.
 *
 * A bare host ("app.finnacalc.com") is the common way to get this wrong, so it
 * is repaired rather than rejected: localhost and loopback get http, anything
 * else https. Whatever comes out is validated by actually constructing a URL,
 * so a caller can rely on it.
 */
function normalizeOrigin(value: string | undefined): string | null {
    if (!value) return null

    const withProtocol = /^https?:\/\//i.test(value)
        ? value
        : `${/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(value) ? "http" : "https"}://${value}`

    try {
        const url = new URL(withProtocol)
        if (!url.hostname) return null
        // Trailing slashes make every joined path double up.
        return url.origin
    } catch {
        return null
    }
}

export const APP_ORIGIN: string =
    normalizeOrigin(configured("NEXT_PUBLIC_APP_ORIGIN")) ?? defaultOrigin()

/**
 * The cookie domain a session must be scoped to for the root domain and the
 * app subdomain to share it. Undefined on localhost, which has no parent
 * domain to scope to — setting one there breaks the cookie entirely.
 */
export const SESSION_COOKIE_DOMAIN: string | undefined = configured(
    "NEXT_PUBLIC_SESSION_COOKIE_DOMAIN"
)

/**
 * A link into the app, preserving where the visitor should land.
 *
 * Never throws. `APP_ORIGIN` is already known-parseable, so the try/catch is
 * belt and braces for a caller passing a path that isn't one — a broken link
 * is a bad afternoon, a failed build is a bad day.
 */
export function appUrl(path = "/", params: Record<string, string> = {}): string {
    try {
        const url = new URL(path, APP_ORIGIN)
        for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
        return url.toString()
    } catch {
        const query = new URLSearchParams(params).toString()
        const safePath = path.startsWith("/") ? path : `/${path}`
        return `${APP_ORIGIN}${safePath}${query ? `?${query}` : ""}`
    }
}

export function loginUrl(next?: string): string {
    return appUrl("/sign-in", next ? { next } : {})
}

export function signUpUrl(next?: string): string {
    return appUrl("/sign-up", next ? { next } : {})
}

/**
 * This site's own canonical origin, for metadataBase. Same treatment as the
 * app origin: metadataBase is constructed at module scope during prerender, so
 * a malformed value here would break the build in exactly the same way.
 */
export const SITE_ORIGIN: string =
    normalizeOrigin(configured("NEXT_PUBLIC_SITE_ORIGIN")) ?? "https://www.finnacalc.com"
