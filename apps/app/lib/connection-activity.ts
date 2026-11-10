import { createClient } from "@supabase/supabase-js"
export function activityAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error("Connection activity unavailable")
    return createClient(url, key, { auth: {autoRefreshToken: false, persistSession: false} })
}
export function missingActivityMigration(error: {code?: string} | null): boolean {
    return !!error && ["42P01", "42883", "PGRST202", "PGRST205"].includes(error.code ?? "")
}
/** Real foreground or new-link activity. Background vendor callbacks never call this. */
export async function touchConnectionActivity(user: string, annualPolicyAcknowledged = false): Promise<void> {
    const {error} = await activityAdmin().rpc("touch_app_activity", {p_user_id: user,p_annual_policy:annualPolicyAcknowledged})
    if (error && !missingActivityMigration(error)) throw new Error("Connection activity unavailable")
    const now = new Date().toISOString()
    const results = await Promise.all([
        activityAdmin().from("snaptrade_users").update({last_seen_at:now}).eq("user_id",user),
        activityAdmin().from("plaid_items").update({last_seen_at:now}).eq("user_id",user),
    ])
    if(results.some(r=>r.error && !missingActivityMigration(r.error) && r.error.code!=="42703")) throw new Error("Connection activity unavailable")
}
/** Block new portals while a previously started cleanup may still be finishing. */
export async function connectionLinkGuard(user: string): Promise<Response | null> {
    try {
        await touchConnectionActivity(user)
        const {data, error} = await activityAdmin().rpc("connection_cleanup_in_progress", {p_user_id: user})
        if (missingActivityMigration(error)) return null // annual cleanup is disabled before migration
        if (error) throw error
        return data === true ? Response.json({error: "A previous connection cleanup is finishing. Please try reconnecting in a moment.", code: "connection_cleanup_in_progress"}, {status: 409}) : null
    } catch { return Response.json({error: "Connection status could not be checked. Please try again."}, {status: 503}) }
}
