import { createClient } from "@supabase/supabase-js"

/**
 * Server-side verification of the app's Supabase access token.
 *
 * The SnapTrade session cookie alone must not authorize real-money actions —
 * it's a long-lived client-held credential (see lib/snaptrade.ts). Trading
 * routes additionally require a signed-in FinnaCalc user: the caller's access
 * token is verified against Supabase, so a stolen cookie can't trade and
 * signing out of the app ends trading authority.
 *
 * Verification uses the public anon key (validating a JWT needs no
 * service-role privileges).
 */
export async function verifiedAppUserId(req: Request): Promise<string | null> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) return null

    const authHeader = req.headers.get("authorization") ?? ""
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""
    if (!token) return null

    try {
        const supabase = createClient(url, anonKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        })
        const { data, error } = await supabase.auth.getUser(token)
        if (error || !data?.user?.id) return null
        return data.user.id
    } catch {
        return null
    }
}
