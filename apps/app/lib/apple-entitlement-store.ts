import { createClient } from "@supabase/supabase-js"
import { AppleSubscriptionError, currentAppleGrant, type AppleGrant } from "./apple-subscriptions"

const TABLE = "apple_subscription_entitlements"
function adminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new AppleSubscriptionError("Subscription storage is not configured. Please contact support.", 503)
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

interface StoredGrant extends AppleGrant { user_id: string; active: boolean; verified_at: string }

export async function saveAppleGrants(userId: string, grants: AppleGrant[], claimLegacy: boolean, checked: Pick<AppleGrant, "environment" | "originalTransactionId">[] = []): Promise<void> {
    const admin = adminClient()
    for (const grant of grants) {
        if (grant.appAccountToken && grant.appAccountToken.toLowerCase() !== userId.toLowerCase()) {
            throw new AppleSubscriptionError("This App Store subscription belongs to a different FinnaCalc account.", 409)
        }
        const { data, error } = await admin.from(TABLE).select("user_id")
            .eq("environment", grant.environment).eq("original_transaction_id", grant.originalTransactionId).maybeSingle()
        if (error) throw new AppleSubscriptionError("Subscription storage is unavailable. Please contact support.", 503)
        if (data && data.user_id !== userId) throw new AppleSubscriptionError("This App Store subscription is already linked to another FinnaCalc account.", 409)
        if (!data && !grant.appAccountToken && !claimLegacy) {
            throw new AppleSubscriptionError("Confirm linking this existing App Store subscription to this FinnaCalc account. It cannot be shared with another FinnaCalc account.", 409)
        }
    }
    // SQL transaction enforces unique ownership even if two accounts claim simultaneously.
    const { error } = await admin.rpc("sync_apple_subscription_entitlements", {
        p_user_id: userId, p_checked: checked.map((grant) => ({ environment: grant.environment, original_transaction_id: grant.originalTransactionId })), p_grants: grants.map((grant) => ({
            original_transaction_id: grant.originalTransactionId, transaction_id: grant.transactionId,
            product_id: grant.productId, tier: grant.tier, expires_at: grant.expiresAt,
            environment: grant.environment, app_account_token: grant.appAccountToken ?? null,
        })),
    })
    if (error) {
        if (error.message.includes("purchase_owned_by_another_account")) throw new AppleSubscriptionError("This App Store subscription is already linked to another FinnaCalc account.", 409)
        throw new AppleSubscriptionError("Subscription access could not be saved. Please try again.", 503)
    }
}

async function loadBoundAppleGrants(userId: string): Promise<StoredGrant[]> {
    const admin = adminClient()
    const { data, error } = await admin.from(TABLE)
        .select("user_id, active, verified_at, original_transaction_id, transaction_id, product_id, tier, expires_at, environment, app_account_token")
        .eq("user_id", userId)
    if (error) throw new AppleSubscriptionError("Subscription storage is unavailable. Please contact support.", 503)
    const rows: StoredGrant[] = (data ?? []).map((row) => ({
        user_id: row.user_id, active: row.active, verified_at: row.verified_at,
        originalTransactionId: row.original_transaction_id, transactionId: row.transaction_id,
        productId: row.product_id, tier: row.tier, expiresAt: row.expires_at, environment: row.environment,
        ...(row.app_account_token ? { appAccountToken: row.app_account_token } : {}),
    }))
    return rows
}

/** Absence from this device is not evidence that this account's purchase expired. */
export async function synchronizeAppleGrants(userId: string, submitted: AppleGrant[], claimLegacy: boolean): Promise<AppleGrant[]> {
    const bound = await loadBoundAppleGrants(userId)
    const key = (grant: Pick<AppleGrant, "environment" | "originalTransactionId">) => `${grant.environment}:${grant.originalTransactionId}`
    const submittedKeys = new Set(submitted.map(key))
    const existing = await Promise.all(bound.filter((row) => !submittedKeys.has(key(row)))
        .map((row) => currentAppleGrant(row.originalTransactionId, row.environment)))
    const grants = [...submitted, ...existing.filter((grant): grant is AppleGrant => grant != null)]
    // All reads succeeded before any mutation. Only rechecked identities may be
    // deactivated, so a concurrent newly bound purchase cannot be cleared.
    await saveAppleGrants(userId, grants, claimLegacy, bound)
    return grants
}

export interface ApplePurchaseIssue {
    code: "legacy_claim_required" | "purchase_owned_by_another_account"
    message: string
}

/** Account access and admission of this device's purchase are separate results. */
export async function synchronizeAppleAccount(userId: string, submitted: AppleGrant[], claimLegacy: boolean): Promise<{ grants: AppleGrant[]; purchaseError?: ApplePurchaseIssue }> {
    try {
        return { grants: await synchronizeAppleGrants(userId, submitted, claimLegacy) }
    } catch (error) {
        if (!(error instanceof AppleSubscriptionError) || error.status !== 409) throw error
        // No conflicting proof was saved: ownership checks precede writes and
        // the RPC rolls back concurrent claim conflicts. Recheck only purchases
        // already bound to this account so another Apple Account on the device
        // cannot disable the signed-in user's existing paid service.
        const grants = await synchronizeAppleGrants(userId, [], false)
        if (grants.length === 0) throw error
        return {
            grants,
            purchaseError: {
                code: error.message.startsWith("Confirm linking") ? "legacy_claim_required" : "purchase_owned_by_another_account",
                message: error.message,
            },
        }
    }
}

export async function loadActiveAppleGrants(userId: string): Promise<AppleGrant[]> {
    const rows = await loadBoundAppleGrants(userId)
    if (rows.some((row) => !Number.isFinite(Date.parse(row.verified_at))
        || Date.now() - Date.parse(row.verified_at) > 15 * 60 * 1000)) {
        const fresh = (await Promise.all(rows.map((row) => currentAppleGrant(row.originalTransactionId, row.environment))))
            .filter((grant): grant is AppleGrant => grant != null)
        await saveAppleGrants(userId, fresh, false, rows)
        return fresh
    }
    return rows.filter((row) => row.active && Date.parse(row.expiresAt) > Date.now()
        && (row.environment === "Production" || process.env.APP_STORE_ALLOW_SANDBOX === "true"))
}

/** Notifications may refresh an existing binding, never create or reassign one. */
export async function refreshAppleNotificationOwner(originalTransactionId: string, environment: AppleGrant["environment"]): Promise<boolean> {
    const { data, error } = await adminClient().from(TABLE).select("user_id")
        .eq("environment", environment).eq("original_transaction_id", originalTransactionId).maybeSingle()
    if (error) throw new AppleSubscriptionError("Subscription storage is unavailable.", 503)
    if (!data?.user_id) return false
    // Current Apple status decides access. Replayed or out-of-order events
    // therefore cannot overwrite a newer renewal, expiry or refund decision.
    await synchronizeAppleGrants(data.user_id, [], false)
    return true
}
