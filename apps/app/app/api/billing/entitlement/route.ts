import { NextRequest, NextResponse } from "next/server"
import { isStripeConfigured } from "@/lib/stripe"
import { entitlementIsActive, loadEntitlement } from "@/lib/billing-entitlements"
import { verifiedAppUserId } from "@/lib/supabase-auth"

// The app's read side of billing: which tier this user holds, if any. The
// row itself is only ever written by the Stripe webhook.
export async function GET(req: NextRequest) {
    if (!isStripeConfigured) {
        // iOS maps 503 to APIError.notConfigured and quietly shows the free
        // state — no error surface for an unlaunched billing system.
        return NextResponse.json({ error: "Subscriptions aren't configured." }, { status: 503 })
    }
    const appUserId = await verifiedAppUserId(req)
    if (!appUserId) {
        return NextResponse.json({ error: "Sign in to view your plan." }, { status: 401 })
    }

    try {
        const row = await loadEntitlement(appUserId)
        const active = entitlementIsActive(row)
        return NextResponse.json({
            tier: active ? row?.tier ?? null : null,
            status: row?.status ?? null,
            interval: active ? row?.billing_interval ?? null : null,
            currentPeriodEnd: active ? row?.current_period_end ?? null : null,
            active,
        })
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Couldn't load your plan." },
            { status: 500 }
        )
    }
}
