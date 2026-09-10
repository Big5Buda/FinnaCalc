import { entitlementIsActive, loadEntitlement } from "./billing-entitlements"
import { loadActiveAppleGrants } from "./apple-entitlement-store"
import type { PlanTier } from "./stripe"

export type PaidFeature = "budgeting" | "investing"
export function tierAllows(tier: PlanTier, feature: PaidFeature): boolean {
    return tier === "pro" || tier === (feature === "budgeting" ? "plus" : "trader")
}

/** Server-authoritative access; no request body can supply its own plan. */
export async function paidFeatureError(userId: string | null, feature: PaidFeature): Promise<Response | null> {
    if (!userId) return Response.json({ error: "Sign in to use your subscription." }, { status: 401 })
    const results = await Promise.allSettled([loadActiveAppleGrants(userId), loadEntitlement(userId)])
    const apple = results[0]
    if (apple.status === "fulfilled" && apple.value.some((grant) => tierAllows(grant.tier, feature))) return null
    const stripe = results[1]
    if (stripe.status === "fulfilled" && entitlementIsActive(stripe.value)
        && stripe.value?.current_period_end && Date.parse(stripe.value.current_period_end) > Date.now()
        && tierAllows(stripe.value.tier, feature)) return null
    if (results.some((result) => result.status === "rejected")) {
        return Response.json({ error: "Subscription access could not be confirmed. Restore purchases or try again shortly." }, { status: 503 })
    }
    return Response.json({ error: `An active ${feature === "budgeting" ? "Budgeting Plus" : "Investing Plus"} or FinnaCalc Pro subscription is required.` }, { status: 403 })
}
