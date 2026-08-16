/**
 * A non-sensitive flag telling the marketing site whether someone is signed in
 * here, so its header can offer "Open app" instead of "Sign in".
 *
 * Deliberately not the session. Supabase's tokens stay in this origin's
 * localStorage, where only this origin can read them. A cookie scoped to
 * .finnacalc.com is readable by every subdomain and by any script running on
 * them, and cookies set from JavaScript cannot be httpOnly — so putting real
 * tokens there would widen the blast radius of an XSS on a page that has no
 * authenticated features at all. This carries one bit and nothing else: not a
 * user id, not an email, not an expiry.
 *
 * The domain comes from NEXT_PUBLIC_SESSION_COOKIE_DOMAIN (".finnacalc.com" in
 * production). Unset, the cookie is host-only, which is correct on localhost —
 * there is no parent domain to share with.
 */

const COOKIE_NAME = "fc_session"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days; refreshed on every sign-in

function domainAttribute(): string {
    const configured = process.env.NEXT_PUBLIC_SESSION_COOKIE_DOMAIN?.trim()
    return configured ? `; Domain=${configured}` : ""
}

function secureAttribute(): string {
    // Secure would make the cookie invisible to itself over plain http, which
    // is how localhost runs.
    return typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : ""
}

export function setSessionHint(): void {
    if (typeof document === "undefined") return
    document.cookie = `${COOKIE_NAME}=1; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${domainAttribute()}${secureAttribute()}`
}

export function clearSessionHint(): void {
    if (typeof document === "undefined") return
    // Expire it on the same domain it was set with, or it survives sign-out.
    document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${domainAttribute()}${secureAttribute()}`
}
