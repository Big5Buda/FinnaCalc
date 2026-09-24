import { NextRequest, NextResponse } from "next/server"
import { activeSnapTradeClientId, getSnapTrade, isSnapTradeConfigured, snapTradeErrorMessage } from "@/lib/snaptrade"
import { loadSession } from "@/lib/snaptrade-session"
import { verifiedAppUserId } from "@/lib/supabase-auth"

// Every brokerage SnapTrade supports, so the app's own picker can search the
// whole list instead of a hardcoded handful. No user credentials are needed:
// this is reference data, identical for everyone, which is why it can be
// cached hard.
//
// Each row carries what the picker needs to be honest: `enabled` /
// `maintenanceMode` say whether connecting will work right now. FinnaCalc
// links every brokerage view-only; `allowsTrading` is still passed through
// because installed iOS builds decode it, not because anything trades. Slugs come from SnapTrade rather than being guessed, which also makes
// the sandbox brokerage ("Alpaca Paper") findable by search.
// `revalidate` alone let Next render this at BUILD time, before the SnapTrade
// environment variables exist, and then serve that answer for a day. The app
// asked for the catalog, got {configured:false,brokerages:[]} from a cache
// dated to the build, and concluded no brokerage supports anything. Vercel
// confirmed it: x-vercel-cache HIT with a four-figure age while every live
// route reported MISS.
//
// So the handler runs per request, and the caching moved in here where it can
// tell the two cases apart: a real catalog is held for a day because it is
// reference data that changes rarely, and an unconfigured or failed answer is
// never held at all. Caching a failure is what turned a missing key into a
// permanent wrong answer.
export const dynamic = "force-dynamic"

type CatalogRow = {
    slug: string
    name: string
    url: string | null
    logo: string | null
    allowsTrading: boolean | null
    enabled: boolean
    maintenanceMode: boolean
}

const caches = new Map<string, { at: number; rows: CatalogRow[] }>()
const TTL_MS = 86_400_000

export async function GET(req: NextRequest) {
    if (!isSnapTradeConfigured) {
        return NextResponse.json({ configured: false, brokerages: [] })
    }
    try {
        const userId = await verifiedAppUserId(req)
        const session = userId ? await loadSession(userId) : null
        const owner = session ?? { clientId: activeSnapTradeClientId() }
        const cache = caches.get(owner.clientId)
        if (cache && Date.now() - cache.at < TTL_MS) {
            return NextResponse.json({ configured: true, brokerages: cache.rows })
        }
        const st = getSnapTrade(owner)
        const res = await st.referenceData.listAllBrokerages()
        const raw = Array.isArray(res.data) ? res.data : []
        const brokerages = raw
            .filter((b: any) => b?.slug)
            .map((b: any) => ({
                slug: String(b.slug),
                name: String(b.display_name || b.name || b.slug),
                url: b.url ?? null,
                logo: b.aws_s3_square_logo_url ?? b.aws_s3_logo_url ?? null,
                allowsTrading: b.allows_trading ?? null,
                enabled: b.enabled ?? true,
                maintenanceMode: b.maintenance_mode ?? false,
            }))
            .sort((a: any, b: any) => a.name.localeCompare(b.name))
        caches.set(owner.clientId, { at: Date.now(), rows: brokerages })
        return NextResponse.json({ configured: true, brokerages })
    } catch (err: any) {
        return NextResponse.json(
            { configured: true, brokerages: [], error: snapTradeErrorMessage(err, "Couldn't load the brokerage list.") },
            { status: 200 }
        )
    }
}
