import { NextRequest, NextResponse } from "next/server"
import { getStripe, isStripeConfigured, stripeErrorMessage } from "@/lib/stripe"
import { loadEntitlement } from "@/lib/billing-entitlements"
import { verifiedAppUserId } from "@/lib/supabase-auth"

// Returns a Stripe customer-portal URL where the user manages the
// subscription themselves — switch plans, change card, cancel. Plan changes
// land back in billing_entitlements via the customer.subscription.updated
// webhook, so the app needs no proration UI of its own.
export async function POST(req: NextRequest) {
    if (!isStripeConfigured) {
        return NextResponse.json({ error: "Subscriptions aren't configured." }, { status: 503 })
    }
    const appUserId = await verifiedAppUserId(req)
    if (!appUserId) {
        return NextResponse.json({ error: "Sign in to manage your plan." }, { status: 401 })
    }

    try {
        const entitlement = await loadEntitlement(appUserId)
        if (!entitlement?.stripe_customer_id) {
            return NextResponse.json({ error: "No subscription found." }, { status: 404 })
        }
        const origin = new URL(req.url).origin
        const session = await getStripe().billingPortal.sessions.create({
            customer: entitlement.stripe_customer_id,
            return_url: `${origin}/billing/done?status=portal`,
        })
        return NextResponse.json({ url: session.url })
    } catch (err) {
        return NextResponse.json(
            { error: stripeErrorMessage(err, "Couldn't open your billing settings. Please try again.") },
            { status: 500 }
        )
    }
}
