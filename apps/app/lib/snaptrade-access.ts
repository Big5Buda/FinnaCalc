import { getSnapTrade, type SnapTradeSession } from "./snaptrade"
import { paidFeatureError } from "./paid-feature-access"

type Connection = { id?: string | null; type?: string | null; created_date?: string | null }

/**
 * Whether SnapTrade reports this link as view-only. Only an explicit "read"
 * counts: a legacy "trade" link, or one with no type at all, is not assumed to
 * be safe.
 */
export function isReadOnlyConnection(connection: Connection): boolean {
    return typeof connection.type === "string" && connection.type.trim().toLowerCase() === "read"
}
export async function listConnections(session: SnapTradeSession): Promise<Connection[]> {
    const { data } = await getSnapTrade(session).connections.listBrokerageAuthorizations({
        userId: session.userId, userSecret: session.userSecret,
    })
    if (!Array.isArray(data)) throw new Error("Brokerage connection count is unavailable.")
    return data
}

/**
 * The connection a plan without investing access counts: the first one made.
 *
 * The Terms promise this ("your portfolio normally counts the first connection
 * you made, and any others stay linked at your brokerage but are left out of
 * the figures"). "First made" is SnapTrade's `created_date` on the
 * authorization, which its SDK documents as optional. If any connection lacks
 * a readable date, or two share the earliest one, which came first is
 * unknowable, so this returns null and the caller refuses rather than guess.
 * A disabled link is not skipped: it is still the first one made, and the
 * user can repair it.
 */
export function countedConnectionId(connections: Connection[]): string | null {
    if (connections.length === 0) return null
    const dated = connections.map((c) => ({ id: c.id, t: c.created_date ? Date.parse(c.created_date) : NaN }))
    if (dated.some((c) => typeof c.id !== "string" || !c.id || !Number.isFinite(c.t))) return null
    const earliest = Math.min(...dated.map((c) => c.t))
    const first = dated.filter((c) => c.t === earliest)
    return first.length === 1 ? String(first[0].id) : null
}

/**
 * What a read may return.
 *
 * By default this is the original rule: more connections than the plan
 * covers is refused with 403 brokerage_connection_limit. A client that asks
 * for `scope=counted` (the iOS app, which says which brokerage is counted) is
 * instead given the counted connection alone, so a free user keeps the
 * brokerage the plan includes and never receives figures from the extra ones.
 * The opt-in exists because a client that does not know about the narrowing
 * would present one brokerage's figures as the whole portfolio.
 * An entitlement outage still fails closed (503), and adding a connection is
 * still refused by brokerageLimitError.
 */
export async function brokerageReadScope(userId: string, session: SnapTradeSession, existing?: Connection[], narrow = false):
    Promise<{ denied: Response } | { countedConnectionId: string | null }> {
    const connections = existing ?? await listConnections(session)
    if (connections.length <= 1) return { countedConnectionId: null }
    const denied = await paidFeatureError(userId, "investing")
    if (!denied) return { countedConnectionId: null }
    if (denied.status !== 403) return { denied }
    const counted = narrow ? countedConnectionId(connections) : null
    if (!counted) return { denied: Response.json({ code: "brokerage_connection_limit", error: LIMIT_MESSAGE }, { status: 403 }) }
    return { countedConnectionId: counted }
}

/** Whether the caller asked for a counted-connection read (`?scope=counted`). */
export function wantsCountedScope(url: string): boolean {
    try { return new URL(url).searchParams.get("scope") === "counted" } catch { return false }
}

const LIMIT_MESSAGE = "The free plan includes one brokerage connection. Disconnect extra brokerages or upgrade to Investing Plus or FinnaCalc Pro. Your brokerage accounts and existing orders are not deleted."

/** Free access includes one brokerage login and all accounts under that login. */
export async function brokerageLimitError(userId: string, session: SnapTradeSession, existing?: Connection[], adding = false): Promise<Response | null> {
    const connections = existing ?? await listConnections(session)
    if (connections.length + (adding ? 1 : 0) <= 1) return null
    const denied = await paidFeatureError(userId, "investing")
    if (denied?.status === 403) return Response.json({
        code: "brokerage_connection_limit",
        error: LIMIT_MESSAGE,
    }, { status: 403 })
    return denied
}
