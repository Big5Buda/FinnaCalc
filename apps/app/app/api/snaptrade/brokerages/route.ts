import { NextResponse } from "next/server"
import { getSnapTrade, isSnapTradeConfigured, snapTradeErrorMessage } from "@/lib/snaptrade"

// Every brokerage SnapTrade supports, so the app's own picker can search the
// whole list instead of a hardcoded handful. No user credentials are needed:
// this is reference data, identical for everyone, which is why it can be
// cached hard.
//
// Each row carries what the picker needs to be honest: `allowsTrading` says
// whether orders are possible at all (Fidelity and Vanguard are read-only),
// and `enabled` / `maintenanceMode` say whether connecting will work right
// now. Slugs come from SnapTrade rather than being guessed, which also makes
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

let cache: { at: number; rows: CatalogRow[] } | null = null
const TTL_MS = 86_400_000

export async function GET() {
    if (!isSnapTradeConfigured) {
        return NextResponse.json({ configured: false, brokerages: [] })
    }
    if (cache && Date.now() - cache.at < TTL_MS) {
        return NextResponse.json({ configured: true, brokerages: cache.rows })
    }
    try {
        const st = getSnapTrade()
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
        cache = { at: Date.now(), rows: brokerages }
        return NextResponse.json({ configured: true, brokerages })
    } catch (err: any) {
        return NextResponse.json(
            { configured: true, brokerages: [], error: snapTradeErrorMessage(err, "Couldn't load the brokerage list.") },
            { status: 200 }
        )
    }
}
