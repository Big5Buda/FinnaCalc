import { NextRequest } from "next/server"
import { randomUUID } from "node:crypto"
import { verifiedAppUserId } from "@/lib/supabase-auth"
import { loadSession } from "@/lib/snaptrade-session"
import { activeSnapTradeClientId, snapTradeKeyNamespace } from "@/lib/snaptrade"
import { integrationReadiness } from "@/lib/snaptrade-readiness"

export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" }
// Describes server/integration readiness, not a particular account's order
// authority, funding mode, plan allowance or symbol eligibility.
export async function GET(req: NextRequest) {
    const blocked = (reasonCode: string, status = 200) => Response.json({ enabled: false,
        tradeConnectionsEnabled: false, supportedBrokerages: [], reasonCode }, { status, headers })
    const owner = await verifiedAppUserId(req)
    if (!owner) return blocked("unauthorized", 401)
    const requestId = randomUUID()
    try {
        const session = await loadSession(owner)
        const clientId = session?.clientId ?? activeSnapTradeClientId()
        const keyNamespace = snapTradeKeyNamespace(clientId)
        const status = await integrationReadiness(clientId)
        // Only computed, validated feature metadata. Never log raw SDK data,
        // request headers/body, owner/client/account IDs, URLs, or error objects.
        console.info("[snaptrade_capability_status]", { requestId, keyNamespace,
            tradingEnabled: status.provider.tradingEnabled,
            connectionBrokerages: status.provider.connectionBrokerages,
            tradingBrokerages: status.provider.tradingBrokerages })
        return Response.json(status, { headers: { ...headers, "X-FinnaCalc-Request-Id": requestId } })
    } catch { return blocked("trading_readiness_unavailable") }
}
