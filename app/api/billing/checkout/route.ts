import { NextRequest, NextResponse } from "next/server"
import {
    getStripe,
    isStripeConfigured,
    priceId,
    stripeErrorMessage,
    type BillingInterval,
    type PlanTier,
    BILLING_INTERVALS,
    PLAN_TIERS,
} from "@/lib/stripe"
import { entitlementIsActive, loadEntitlement } from "@/lib/billing-entitlements"
import { verifiedAppUserId } from "@/lib/supabase-auth"

// Creates a Stripe Checkout session for one subscription tier and returns its
// URL. The iOS app opens it in a browser session; nothing is granted here —
// the webhook (app/api/billing/webhook) records the entitlement once Stripe
// confirms payment, so a client can never claim a tier by calling this.
export async function POST(req: NextRequest) {
    if (!isStripeConfigured) {
        return NextResponse.json(
            { error: "Subscriptions aren't configured. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET." },
            { status: 503 }
        )
    }
    const appUserId = await verifiedAppUserId(req)
    if (!appUserId) {
        return NextResponse.json({ error: "Sign in to subscribe." }, { status: 401 })
    }

    let body: { tier?: string; interval?: string; platform?: string }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
    }
    const tier = body.tier as PlanTier
    const interval = (body.interval ?? "monthly") as BillingInterval
    if (!PLAN_TIERS.includes(tier)) {
        return NextResponse.json({ error: "tier must be plus, trader or pro." }, { status: 400 })
    }
    if (!BILLING_INTERVALS.includes(interval)) {
        return NextResponse.json({ error: "interval must be monthly or annual." }, { status: 400 })
    }
    const price = priceId(tier, interval)
    if (!price) {
        return NextResponse.json(
            { error: "That plan isn't available yet. Add its STRIPE_PRICE_* environment variable." },
            { status: 503 }
        )
    }

    try {
        // One subscription per user: an active subscriber changes plans in the
        // Stripe customer portal (/api/billing/portal) — a second Checkout
        // would happily double-charge them.
        const existing = await loadEntitlement(appUserId)
        if (entitlementIsActive(existing)) {
            return NextResponse.json(
                { error: "You already have an active plan. Manage or change it from your plan settings." },
                { status: 409 }
            )
        }

        const origin = new URL(req.url).origin
        const stripe = getStripe()
        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            line_items: [{ price, quantity: 1 }],
            // Both identifiers so the webhook can attribute the purchase even
            // when only one of the checkout/subscription objects is at hand.
            client_reference_id: appUserId,
            subscription_data: { metadata: { app_user_id: appUserId } },
            // Re-use the Stripe customer a past subscription created so their
            // history and portal stay in one place.
            ...(existing?.stripe_customer_id ? { customer: existing.stripe_customer_id } : {}),
            allow_promotion_codes: true,
            success_url: `${origin}/billing/done?status=success`,
            cancel_url: `${origin}/billing/done?status=cancel`,
        })
        if (!session.url) throw new Error("Stripe didn't return a checkout link.")
        return NextResponse.json({ url: session.url })
    } catch (err) {
        return NextResponse.json(
            { error: stripeErrorMessage(err, "Couldn't start checkout. Please try again.") },
            { status: 500 }
        )
    }
}
