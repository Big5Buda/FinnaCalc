import { NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"
import {
    getStripe,
    getWebhookSecret,
    intervalForPriceId,
    isStripeConfigured,
    tierForPriceId,
} from "@/lib/stripe"
import {
    findUserIdByCustomer,
    upsertEntitlement,
    type EntitlementRow,
} from "@/lib/billing-entitlements"

// Signature verification needs the raw request body, and the stripe SDK needs
// Node APIs — keep this off the edge runtime.
export const runtime = "nodejs"

// The sole writer of billing_entitlements: Stripe tells us what happened and
// we mirror it. The app never grants itself a tier — it only reads the rows
// this route writes.
//
// Configure the endpoint in the Stripe Dashboard (or `stripe listen` locally)
// for: checkout.session.completed, customer.subscription.updated,
// customer.subscription.deleted.
export async function POST(req: NextRequest) {
    if (!isStripeConfigured) {
        return NextResponse.json({ error: "Stripe isn't configured." }, { status: 503 })
    }

    const signature = req.headers.get("stripe-signature")
    if (!signature) {
        return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 })
    }

    let event: Stripe.Event
    try {
        const raw = await req.text()
        event = getStripe().webhooks.constructEvent(raw, signature, getWebhookSecret())
    } catch {
        return NextResponse.json({ error: "Invalid signature." }, { status: 400 })
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session
                const appUserId = session.client_reference_id
                const subscriptionId =
                    typeof session.subscription === "string"
                        ? session.subscription
                        : session.subscription?.id
                if (!appUserId || !subscriptionId) break
                const sub = await getStripe().subscriptions.retrieve(subscriptionId)
                await recordSubscription(sub, appUserId)
                break
            }
            case "customer.subscription.updated": {
                const sub = event.data.object as Stripe.Subscription
                await recordSubscription(sub, null)
                break
            }
            case "customer.subscription.deleted": {
                const sub = event.data.object as Stripe.Subscription
                await recordSubscription(sub, null, "canceled")
                break
            }
            default:
                // Not ours — acknowledge so Stripe stops retrying it.
                break
        }
        return NextResponse.json({ received: true })
    } catch (err) {
        // Non-2xx makes Stripe retry with backoff — right for transient DB
        // trouble, since the upsert is idempotent.
        console.error("[billing-webhook] failed to process", event.type, err)
        return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 })
    }
}

/**
 * Mirrors one subscription into billing_entitlements. `appUserId` comes from
 * checkout's client_reference_id when available; otherwise it's recovered from
 * the subscription metadata, then from the stored Stripe customer id. A
 * canceled subscription keeps its row (status only) so the customer id
 * survives for the portal and any later re-subscribe.
 */
async function recordSubscription(
    sub: Stripe.Subscription,
    appUserId: string | null,
    forcedStatus?: string
): Promise<void> {
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null
    const userId =
        appUserId ??
        (typeof sub.metadata?.app_user_id === "string" && sub.metadata.app_user_id
            ? sub.metadata.app_user_id
            : customerId
              ? await findUserIdByCustomer(customerId)
              : null)
    if (!userId) {
        console.error("[billing-webhook] no app user for subscription", sub.id)
        return
    }

    const item = sub.items?.data?.[0]
    const price = item?.price?.id ?? null
    const tier = tierForPriceId(price)
    if (!tier) {
        console.error("[billing-webhook] unknown price on subscription", sub.id, price)
        return
    }

    // current_period_end lives on the subscription in older Stripe API
    // versions and on the item in newer ones — read whichever is present.
    const periodEnd =
        (sub as unknown as { current_period_end?: number }).current_period_end ??
        (item as unknown as { current_period_end?: number })?.current_period_end ??
        null

    const row: EntitlementRow = {
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        tier,
        status: forcedStatus ?? sub.status,
        billing_interval: intervalForPriceId(price),
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    }
    await upsertEntitlement(row)
}
