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

/**
 * The cap is per account now: two included, plus one for each bank add-on
 * held (lib/bank-allowance.ts). The number is not a constant here any more
 * because three copies of it, in TypeScript, in SQL and in an error string,
 * is how a paid connection gets refused by whichever copy was not updated.
 */
export class BankConnectionLimitError extends Error {
    constructor(readonly allowance: number) {
        super(`Your plan includes ${allowance} bank login${allowance === 1 ? "" : "s"}. `
            + "Disconnect a bank in Connected accounts before adding another.")
    }
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
    /** When the login was first linked. Present on reads, absent on writes. */
    linkedAt?: string
}

/** Every institution this user has linked. */
export async function loadItems(appUserId: string): Promise<PlaidItem[]> {
    const { data, error } = await adminClient()
        .from(TABLE)
        .select("item_id, access_token, institution, created_at")
        // Oldest first, so "the ones your plan includes" is answerable: the
        // add-on buys capacity rather than a named bank, and the honest way
        // to say which login it is paying for is the order they were linked.
        .order("created_at", { ascending: true })
        .eq("user_id", appUserId)
    if (error) throw dbError(error)
    return (data ?? []).map((row: any) => ({
        itemId: row.item_id,
        accessToken: row.access_token,
        institution: row.institution ?? null,
        ...(row.created_at ? { linkedAt: row.created_at } : {}),
    }))
}

/**
 * Records a freshly exchanged token. Upserts on item_id so re-linking an
 * institution replaces its token instead of leaving a stale row that would
 * fail on the next read.
 */
export async function saveItem(
    appUserId: string,
    item: PlaidItem,
    allowance: number
): Promise<void> {
    // The SQL function serializes new links per account. A read/count followed
    // by a client-side upsert would let simultaneous requests exceed the cap.
    // The allowance is passed in rather than read there: entitlements are the
    // application's business, and the function stays a lock and a count.
    const admin = adminClient()
    const call = (args: Record<string, unknown>) => admin.rpc("save_plaid_item_with_limit", args)
    const base = {
        p_user_id: appUserId, p_item_id: item.itemId,
        p_access_token: item.accessToken, p_institution: item.institution,
    }
    let { error } = await call({ ...base, p_max_items: allowance })
    // The five-argument function arrives with bank_connection_addon.sql. If
    // the deploy lands first, this falls back to the four-argument one rather
    // than failing every bank link until someone runs the migration. The old
    // function caps at two, which is what the app did yesterday.
    if (error && /save_plaid_item_with_limit|schema cache|does not exist/i.test(error.message)) {
        ;({ error } = await call(base))
    }
    if (error?.message.includes("bank_connection_limit_reached")) throw new BankConnectionLimitError(allowance)
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
