// Internal developer access, explicitly configured by an operator for exact
// verified Supabase user UUIDs. This is separate from billing and DEBUG UI.
// Never expose these variables through NEXT_PUBLIC_, a response, or a log.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function allowlisted(variable: string, verifiedUserId: string | null): boolean {
    if (!verifiedUserId || !UUID.test(verifiedUserId)) return false
    const allowed = (process.env[variable] ?? "")
        .split(",").map(value => value.trim()).filter(value => UUID.test(value))
    return allowed.some(value => value.toLowerCase() === verifiedUserId.toLowerCase())
}

/** Brokerage/investing feature access (FINNACALC_DEVELOPER_INVESTING_USER_IDS). */
export function developerInvestingAccess(verifiedUserId: string | null): boolean {
    return allowlisted("FINNACALC_DEVELOPER_INVESTING_USER_IDS", verifiedUserId)
}

/**
 * FinnaBot personal-context access for both domains (budget + portfolio)
 * without a purchase (FINNACALC_DEVELOPER_AI_USER_IDS). Purpose-specific: it
 * authorizes only including the user's OWN client-supplied snapshot in their
 * own FinnaBot prompt. It grants no paid tier, no Plaid/SnapTrade access, no
 * Budget Analysis and no model/token change, and it never overrides a domain
 * the client has locked (free preview stays restrictive).
 */
export function developerAIAccess(verifiedUserId: string | null): boolean {
    return allowlisted("FINNACALC_DEVELOPER_AI_USER_IDS", verifiedUserId)
}
