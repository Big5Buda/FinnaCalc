import Stripe from "stripe"

/**
 * Server-side Stripe client for FinnaCalc subscriptions (Plus / Trader / Pro).
 *
 * Required environment variables:
 *   STRIPE_SECRET_KEY        — sk_test_… / sk_live_…
 *   STRIPE_WEBHOOK_SECRET    — whsec_… (from `stripe listen` or the Dashboard)
 *   STRIPE_PRICE_PLUS_MONTHLY / STRIPE_PRICE_PLUS_ANNUAL
 *   STRIPE_PRICE_TRADER_MONTHLY / STRIPE_PRICE_TRADER_ANNUAL
 *   STRIPE_PRICE_PRO_MONTHLY / STRIPE_PRICE_PRO_ANNUAL
 *
 * Billing is Stripe web checkout (not Apple IAP): the iOS app opens the
 * Checkout URL in a browser session, the webhook records the entitlement in
 * Supabase (lib/billing-entitlements.ts), and the app reads it back over the
 * authenticated /api/billing/entitlement route. Price IDs live only here —
 * the app ships display prices, never Stripe identifiers.
 */

const secretKey = process.env.STRIPE_SECRET_KEY
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

export const isStripeConfigured = Boolean(secretKey && webhookSecret)

export type PlanTier = "plus" | "trader" | "pro"
export type BillingInterval = "monthly" | "annual"

export const PLAN_TIERS: readonly PlanTier[] = ["plus", "trader", "pro"] as const
export const BILLING_INTERVALS: readonly BillingInterval[] = ["monthly", "annual"] as const

let client: Stripe | null = null

export function getStripe(): Stripe {
    if (!secretKey) {
        throw new Error("Stripe is not configured.")
    }
    if (!client) {
        client = new Stripe(secretKey)
    }
    return client
}

export function getWebhookSecret(): string {
    if (!webhookSecret) throw new Error("Stripe webhook secret is not configured.")
    return webhookSecret
}

const PRICE_ENV: Record<PlanTier, Record<BillingInterval, string | undefined>> = {
    plus: {
        monthly: process.env.STRIPE_PRICE_PLUS_MONTHLY,
        annual: process.env.STRIPE_PRICE_PLUS_ANNUAL,
    },
    trader: {
        monthly: process.env.STRIPE_PRICE_TRADER_MONTHLY,
        annual: process.env.STRIPE_PRICE_TRADER_ANNUAL,
    },
    pro: {
        monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
        annual: process.env.STRIPE_PRICE_PRO_ANNUAL,
    },
}

/** The Stripe price id for a tier/interval, or null when not configured. */
export function priceId(tier: PlanTier, interval: BillingInterval): string | null {
    return PRICE_ENV[tier]?.[interval] || null
}

/** Reverse lookup for webhook events: which tier a Stripe price belongs to. */
export function tierForPriceId(id: string | null | undefined): PlanTier | null {
    if (!id) return null
    for (const tier of PLAN_TIERS) {
        for (const interval of BILLING_INTERVALS) {
            if (PRICE_ENV[tier][interval] === id) return tier
        }
    }
    return null
}

/** Which billing interval a Stripe price belongs to, for display only. */
export function intervalForPriceId(id: string | null | undefined): BillingInterval | null {
    if (!id) return null
    for (const tier of PLAN_TIERS) {
        for (const interval of BILLING_INTERVALS) {
            if (PRICE_ENV[tier][interval] === id) return interval
        }
    }
    return null
}

/** Friendly message from a Stripe error, falling back when it's unusable. */
export function stripeErrorMessage(err: unknown, fallback: string): string {
    const message = (err as { message?: unknown })?.message
    if (typeof message === "string" && message.trim()) return message
    return fallback
}
