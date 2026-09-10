import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Server-side Plaid item store.
 *
 * A Plaid access_token is the long-lived credential for one linked
 * institution. It lives in the `plaid_items` table (supabase/plaid_items.sql),
 * keyed to the signed-in Supabase user and readable only with the
 * service_role key (RLS enabled, no policies) — the same arrangement
 * lib/snaptrade-session.ts uses for brokerage credentials.
 *
 * Before this existed, every Plaid route exchanged a fresh public_token, made
 * one call, and discarded the token, so a linked bank could never be re-read:
 * transactions were an import-once snapshot and balances weren't fetched at
 * all. Persisting the token is what makes refresh — and therefore a current
 * balance — possible.
 */

const TABLE = "plaid_items"
export const MAX_BANK_CONNECTIONS = 2
export class BankConnectionLimitError extends Error {
    constructor() { super("Your plan includes 2 bank logins. Disconnect a bank in Connected accounts before adding another.") }
}
export class BankConnectionOwnershipError extends Error {
    constructor() { super("This bank connection belongs to another account. Connect your own bank login.") }
}

let admin: SupabaseClient | null = null

function adminClient(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceRole) {
        throw new Error("Bank connections aren't configured. Add SUPABASE_SERVICE_ROLE_KEY.")
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
            "The plaid_items table doesn't exist yet — run supabase/plaid_items.sql in the Supabase SQL editor."
        )
    }
    return new Error(error.message || "Bank connection store error.")
}

export interface PlaidItem {
    itemId: string
    accessToken: string
    institution: string | null
}

/** Every institution this user has linked. */
export async function loadItems(appUserId: string): Promise<PlaidItem[]> {
    const { data, error } = await adminClient()
        .from(TABLE)
        .select("item_id, access_token, institution")
        .eq("user_id", appUserId)
    if (error) throw dbError(error)
    return (data ?? []).map((row: any) => ({
        itemId: row.item_id,
        accessToken: row.access_token,
        institution: row.institution ?? null,
    }))
}

/**
 * Records a freshly exchanged token. Upserts on item_id so re-linking an
 * institution replaces its token instead of leaving a stale row that would
 * fail on the next read.
 */
export async function saveItem(
    appUserId: string,
    item: PlaidItem
): Promise<void> {
    // The SQL function serializes new links per account. A read/count followed
    // by a client-side upsert would let simultaneous requests exceed the cap.
    const { error } = await adminClient().rpc("save_plaid_item_with_limit", {
        p_user_id: appUserId, p_item_id: item.itemId,
        p_access_token: item.accessToken, p_institution: item.institution,
    })
    if (error?.message.includes("bank_connection_limit_reached")) throw new BankConnectionLimitError()
    if (error?.message.includes("item_owned_by_another_account")) throw new BankConnectionOwnershipError()
    if (error) throw dbError(error)
}

/** Resolve an ambiguous save before deciding whether a vendor rollback is safe. */
export async function loadItemOwner(itemId: string): Promise<string | null> {
    const { data, error } = await adminClient().from(TABLE).select("user_id").eq("item_id", itemId).maybeSingle()
    if (error) throw dbError(error)
    return data?.user_id ?? null
}

/** Forgets one institution (the user disconnected it). */
export async function deleteItem(appUserId: string, itemId: string): Promise<void> {
    const { error } = await adminClient()
        .from(TABLE)
        .delete()
        .eq("user_id", appUserId)
        .eq("item_id", itemId)
    if (error) throw dbError(error)
}

/** Forgets every institution — used when an account is deleted. */
export async function deleteAllItems(appUserId: string): Promise<void> {
    const { error } = await adminClient().from(TABLE).delete().eq("user_id", appUserId)
    if (error) throw dbError(error)
}
