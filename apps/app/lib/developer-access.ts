// Internal investing access, explicitly configured by an operator for exact
// verified Supabase user UUIDs. This is separate from billing and DEBUG UI.
// Never expose this variable through NEXT_PUBLIC_, a response, or a log.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function developerInvestingAccess(verifiedUserId: string | null): boolean {
    if (!verifiedUserId || !UUID.test(verifiedUserId)) return false
    const allowed = (process.env.FINNACALC_DEVELOPER_INVESTING_USER_IDS ?? "")
        .split(",").map(value => value.trim()).filter(value => UUID.test(value))
    return allowed.some(value => value.toLowerCase() === verifiedUserId.toLowerCase())
}
