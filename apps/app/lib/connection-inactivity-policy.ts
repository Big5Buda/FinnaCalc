/** Provider-verified billing facts only; unknown or mixed monthly access retains links. */
export type InactivityPlan = "annual" | "monthly" | "free" | "retain"
export interface InactivityGrant { tier: string; interval: string | null }
export function inactivityPlan(grants: InactivityGrant[], verified: boolean, developer: boolean): InactivityPlan {
    if (!verified || developer) return "retain"
    const plans = grants.filter(g => ["plus", "trader", "pro"].includes(g.tier))
    if (plans.some(g => g.interval !== "monthly" && g.interval !== "annual")) return "retain"
    if (plans.some(g => g.interval === "monthly")) return "monthly"
    return plans.length ? "annual" : "free"
}
export function dormant(lastSeen: string | null, days: number, now: number): boolean {
    const seen = lastSeen == null ? NaN : Date.parse(lastSeen)
    return Number.isFinite(seen) && seen <= now - days * 86_400_000
}
