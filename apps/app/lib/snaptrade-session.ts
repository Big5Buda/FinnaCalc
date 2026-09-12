import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { randomUUID } from "crypto"
import { activeSnapTradeClientId, getSnapTrade, snapTradeCredentials, type SnapTradeSession } from "./snaptrade"

/**
 * Server-side SnapTrade credential store.
 *
 * The SnapTrade { userId, userSecret } pair is the long-lived brokerage
 * credential. It used to live in a year-long httpOnly cookie on the client;
 * now it lives in the `snaptrade_users` table (supabase/snaptrade_users.sql),
 * keyed to the signed-in Supabase user and readable only with the
 * service_role key (RLS enabled, no policies). Consequences:
 *   - a stolen cookie or device backup no longer carries broker credentials
 *   - signing out of FinnaCalc ends brokerage access on that device
 *   - the link follows the account across devices
 *   - sessions can be revoked server-side by deleting the row
 *
 * Deliberately NOT migrated from the old cookie: an earlier version of this
 * module adopted any well-formed cookie into whichever account was signed in
 * on that browser/device, with no proof the cookie belonged to them — on a
 * shared device that silently and permanently binds one person's brokerage
 * credentials (and real-money trade authority) to someone else's account,
 * and pre-launch there are no real users depending on it. Anyone with an old
 * cookie just reconnects their broker once.
 */

const TABLE = "snaptrade_users"

let admin: SupabaseClient | null = null

function adminClient(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceRole) {
        throw new Error("Brokerage sessions aren't configured. Add SUPABASE_SERVICE_ROLE_KEY.")
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
            "The snaptrade_users table doesn't exist yet — run supabase/snaptrade_users.sql in the Supabase SQL editor."
        )
    }
    return new Error(error.message || "Brokerage session store error.")
}

/** The stored SnapTrade credentials for an app user, or null if never linked. */
export async function loadSession(appUserId: string): Promise<SnapTradeSession | null> {
    const { data, error } = await adminClient()
        .from(TABLE)
        .select("st_user_id, st_user_secret, client_id")
        .eq("user_id", appUserId)
        .maybeSingle()
    if (error) throw dbError(error)
    if (!data) return null
    if (!data.st_user_id || !data.st_user_secret) throw new Error("Brokerage credentials are incomplete. Your connection has been preserved; please contact support.")
    snapTradeCredentials(data.client_id)
    return { userId: data.st_user_id, userSecret: data.st_user_secret, clientId: data.client_id }
}

/** Delete only the exact owner/user whose vendor deletion was accepted. */
export async function deleteSession(appUserId: string, session: Pick<SnapTradeSession, "clientId" | "userId">): Promise<void> {
    snapTradeCredentials(session.clientId)
    const { error } = await adminClient().rpc("delete_snaptrade_session", {
        p_user_id: appUserId, p_client_id: session.clientId, p_st_user_id: session.userId,
    })
    if (error) throw dbError(error)
}

/** A valid signature from a different key never authenticates this user's event. */
export async function snapTradeWebhookOwner(userId: string): Promise<string | null> {
    const { data, error } = await adminClient().from(TABLE).select("client_id")
        .eq("st_user_id", userId).maybeSingle()
    if (error) throw dbError(error)
    return data?.client_id ?? null
}

/**
 * Loads the user's session, registering a brand-new SnapTrade user (the
 * connect flow) when none exists yet.
 *
 * Concurrent first-connects (double-tap, or web + iOS at once) are handled
 * without orphaning a SnapTrade user: the insert uses `ignoreDuplicates` so
 * only the first writer's row survives (user_id is the primary key); a
 * losing request detects it lost the race and deletes the SnapTrade user it
 * just registered, so nothing is left live with no DB reference (SnapTrade
 * bills per connected user — an orphan would keep costing money and, if a
 * portal tab for it is still open, could attach a real brokerage connection
 * nothing can ever find again).
 */
export async function resolveOrCreateSession(appUserId: string): Promise<SnapTradeSession> {
    const existing = await loadSession(appUserId)
    if (existing) return existing

    const clientId = activeSnapTradeClientId()
    const st = getSnapTrade({ clientId })
    const reg = await st.authentication.registerSnapTradeUser({ userId: `finnacalc-${randomUUID()}` })
    const session: SnapTradeSession = {
        userId: reg.data.userId as string,
        userSecret: reg.data.userSecret as string,
        clientId,
    }

    const client = adminClient()
    const { error } = await client
        .from(TABLE)
        .upsert(
            { user_id: appUserId, st_user_id: session.userId, st_user_secret: session.userSecret, client_id: session.clientId },
            { onConflict: "user_id", ignoreDuplicates: true }
        )
    if (error) throw dbError(error)

    const winner = await loadSession(appUserId)
    if (!winner) throw new Error("Failed to create a brokerage session.")
    if (winner.userId !== session.userId || winner.clientId !== session.clientId) {
        // Lost the race — a concurrent request's row won. Delete the
        // now-unreferenced SnapTrade user we just registered.
        try {
            await st.authentication.deleteSnapTradeUser({ userId: session.userId })
        } catch {
            console.error("[snaptrade-session] failed to clean up unreferenced SnapTrade registration.")
        }
    }
    return winner
}
