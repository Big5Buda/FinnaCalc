import { getSnapTrade, type SnapTradeSession } from "./snaptrade"
import { paidFeatureError } from "./paid-feature-access"

type Connection = { id?: string | null; type?: string | null }

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

/** Free access includes one brokerage login and all accounts under that login. */
export async function brokerageLimitError(userId: string, session: SnapTradeSession, existing?: Connection[], adding = false): Promise<Response | null> {
    const connections = existing ?? await listConnections(session)
    if (connections.length + (adding ? 1 : 0) <= 1) return null
    const denied = await paidFeatureError(userId, "investing")
    if (denied?.status === 403) return Response.json({
        code: "brokerage_connection_limit",
        error: "The free plan includes one brokerage connection. Disconnect extra brokerages or upgrade to Investing Plus or FinnaCalc Pro. Your brokerage accounts and existing orders are not deleted.",
    }, { status: 403 })
    return denied
}
