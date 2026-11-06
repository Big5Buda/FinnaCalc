import { entitlementIsActive, loadEntitlement } from "./billing-entitlements"
import { loadActiveAppleGrants } from "./apple-entitlement-store"
import type { AppleProductKind } from "./apple-subscriptions"
import { randomUUID } from "node:crypto"
import { developerInvestingAccess } from "./developer-access"

export type PaidFeature = "budgeting" | "investing"

/**
 * Takes the wider kind on purpose. An add-on is stored in the same column as
 * a tier and reaches here with the rest of a user's grants; matching three
 * literals means it answers false and buys no feature, which is the
 * behaviour to preserve if more non-tier products are ever sold.
 */
export function tierAllows(tier: AppleProductKind, feature: PaidFeature): boolean {
    return tier === "pro" || tier === (feature === "budgeting" ? "plus" : "trader")
}

/** Server-authoritative access; no request body can supply its own plan. */
export async function paidFeatureError(userId: string | null, feature: PaidFeature): Promise<Response | null> {
    if (!userId) return Response.json({ error: "Sign in to use your subscription." }, { status: 401 })
    // Dedicated server-authorized investing access does not fabricate a paid
    // tier and never trusts a client DEBUG/developer selection.
    if (feature === "investing" && developerInvestingAccess(userId)) return null
    const results = await Promise.allSettled([loadActiveAppleGrants(userId), loadEntitlement(userId)])
    const apple = results[0]
    if (apple.status === "fulfilled" && apple.value.some((grant) => tierAllows(grant.tier, feature))) return null
    const stripe = results[1]
    if (stripe.status === "fulfilled" && entitlementIsActive(stripe.value)
        && stripe.value?.current_period_end && Date.parse(stripe.value.current_period_end) > Date.now()
        && tierAllows(stripe.value.tier, feature)) return null
    if (results.some((result) => result.status === "rejected")) {
        const requestId = randomUUID()
        // Only internal store labels and validated DB error codes. SDK error
        // messages/URLs/bodies can contain credentials and are never logged.
        const knownCodes = new Set(["42P01", "42703", "42501", "PGRST205", "PGRST204", "PGRST301", "PGRST302", "PGRST116", "08000", "08006", "57014", "53300"])
        const failures = results.flatMap((result, index) => {
            if (result.status !== "rejected") return []
            const code = result.reason?.storeCode
            return [{ stage: index === 0 ? "apple_entitlements" : "stripe_entitlements",
                code: knownCodes.has(code) ? code : "unavailable" }]
        })
        console.warn("[entitlement_unavailable]", { requestId, failures })
        return Response.json({ code: "entitlement_unavailable", requestId,
            error: "Subscription access could not be verified. Try again shortly; if this continues, contact support with the reference." }, { status: 503 })
    }
    return Response.json({ error: `An active ${feature === "budgeting" ? "Budgeting Plus" : "Investing Plus"} or FinnaCalc Pro subscription is required.` }, { status: 403 })
}
