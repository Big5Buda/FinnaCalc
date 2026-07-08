import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Browser-side Supabase client (singleton).
 *
 * Required environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL       – your project URL (Settings → API)
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY  – the public anon key (Settings → API)
 *
 * The anon key is safe to expose to the browser; row-level security on the
 * Supabase side is what protects your data. The session is persisted in
 * localStorage and refreshed automatically.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
    if (!isSupabaseConfigured) {
        throw new Error(
            "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment variables."
        )
    }
    if (!client) {
        client = createClient(supabaseUrl as string, supabaseAnonKey as string, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
            },
        })
    }
    return client
}

/**
 * Authorization header for API routes that verify the signed-in user
 * (brokerage/trading routes). Empty when signed out or unconfigured — the
 * route then responds 401 and the UI shows its sign-in prompt.
 */
export async function supabaseAuthHeader(): Promise<Record<string, string>> {
    if (!isSupabaseConfigured) return {}
    try {
        const { data } = await getSupabase().auth.getSession()
        const token = data.session?.access_token
        return token ? { Authorization: `Bearer ${token}` } : {}
    } catch {
        return {}
    }
}
