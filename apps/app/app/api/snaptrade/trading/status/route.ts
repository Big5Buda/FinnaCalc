import { NextRequest } from "next/server"
import { verifiedAppUserId } from "@/lib/supabase-auth"
import { loadSession } from "@/lib/snaptrade-session"
import { activeSnapTradeClientId } from "@/lib/snaptrade"
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
    try {
        const session = await loadSession(owner)
        const clientId = session?.clientId ?? activeSnapTradeClientId()
        return Response.json(await integrationReadiness(clientId), { headers })
    } catch { return blocked("trading_readiness_unavailable") }
}
