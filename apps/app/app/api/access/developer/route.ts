import { NextRequest } from "next/server"
import { verifiedAppUserId } from "@/lib/supabase-auth"
import { developerInvestingAccess } from "@/lib/developer-access"

export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" }
export async function GET(req: NextRequest) {
    const owner = await verifiedAppUserId(req)
    if (!owner) return Response.json({ error: "Sign in to view developer access." }, { status: 401, headers })
    const enabled = developerInvestingAccess(owner)
    return Response.json({ investingDeveloperAccess: enabled, unlimitedBrokerageConnections: enabled }, { headers })
}
