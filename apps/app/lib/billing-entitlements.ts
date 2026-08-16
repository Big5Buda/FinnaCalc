import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { BillingInterval, PlanTier } from "./stripe"

/**
 * Server-side subscription entitlement store.
 *
 * One row per user in `billing_entitlements` (supabase/billing_entitlements.sql),
 * written by the Stripe webhook and read by /api/billing/entitlement. Only the
 * service_role key can touch the table (RLS enabled, no policies), so the
 * client can never grant itself a tier — the webhook is the sole authority.
 */

const TABLE = "billing_entitlements"

let admin: SupabaseClient | null = null

function adminClient(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceRole) {
        throw new Error("Billing isn't configured. Add SUPABASE_SERVICE_ROLE_KEY.")
    }
    if (!admin) {
        admin = createClient(url, serviceRole, {
            auth: { autoRefreshToken: false, persistSession: false },
        })
    }
    return admin
}

/** Wraps Supabase errors with a hint when the table hasn't been created yet. */
function dbError(error: { code?: string; message?: string }): Error {
    if (error.code === "42P01") {
        return new Error(
            "The billing_entitlements table doesn't exist yet — run supabase/billing_entitlements.sql in the Supabase SQL editor."
        )
    }
    return new Error(error.message || "Billing entitlement store error.")
}

export interface EntitlementRow {
    user_id: string
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    tier: PlanTier
    status: string
    billing_interval: BillingInterval | null
    current_period_end: string | null
}

/** The stored entitlement for an app user, or null if they never subscribed. */
export async function loadEntitlement(appUserId: string): Promise<EntitlementRow | null> {
    const { data, error } = await adminClient()
        .from(TABLE)
        .select(
            "user_id, stripe_customer_id, stripe_subscription_id, tier, status, billing_interval, current_period_end"
        )
        .eq("user_id", appUserId)
        .maybeSingle()
    if (error) throw dbError(error)
    return (data as EntitlementRow | null) ?? null
}

export async function upsertEntitlement(row: EntitlementRow): Promise<void> {
    const { error } = await adminClient()
        .from(TABLE)
        .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    if (error) throw dbError(error)
}

/**
 * Finds the app user for a Stripe customer — the fallback for webhook events
 * that carry no metadata (e.g. a subscription updated from the Dashboard).
 */
export async function findUserIdByCustomer(stripeCustomerId: string): Promise<string | null> {
    const { data, error } = await adminClient()
        .from(TABLE)
        .select("user_id")
        .eq("stripe_customer_id", stripeCustomerId)
        .maybeSingle()
    if (error) throw dbError(error)
    return data?.user_id ?? null
}

/** The single place deciding which Stripe statuses count as "has the tier". */
export function entitlementIsActive(row: EntitlementRow | null): boolean {
    return row != null && ["active", "trialing"].includes(row.status)
}
