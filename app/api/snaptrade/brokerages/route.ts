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
export const revalidate = 86400

export async function GET() {
    if (!isSnapTradeConfigured) {
        return NextResponse.json({ configured: false, brokerages: [] })
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
        return NextResponse.json({ configured: true, brokerages })
    } catch (err: any) {
        return NextResponse.json(
            { configured: true, brokerages: [], error: snapTradeErrorMessage(err, "Couldn't load the brokerage list.") },
            { status: 200 }
        )
    }
}
