import { loadActiveAppleGrants } from "./apple-entitlement-store"
import { BANK_ADDON_PRODUCT_ID } from "./apple-subscriptions"

/**
 * How many bank logins an account may hold.
 *
 * Every plan that includes bank connections carries two. Each active bank
 * add-on buys one more, so the cap is a per-account question rather than a
 * constant, and the answer has to come from the server: a client that asked
 * for a higher limit would be asking to be trusted about what it had paid
 * for.
 *
 * Fails closed. If entitlements cannot be read the answer is the included
 * two, never more, so an outage can only ever refuse a connection somebody
 * paid for rather than hand out one nobody did.
 */
export const INCLUDED_BANK_CONNECTIONS = 2

export async function bankConnectionAllowance(userId: string): Promise<number> {
    try {
        const grants = await loadActiveAppleGrants(userId)
        const addOns = grants.filter((grant) => grant.productId === BANK_ADDON_PRODUCT_ID
            && grant.tier === "bank_addon").length
        return INCLUDED_BANK_CONNECTIONS + addOns
    } catch {
        return INCLUDED_BANK_CONNECTIONS
    }
}
