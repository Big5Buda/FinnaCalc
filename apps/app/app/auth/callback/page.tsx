"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase"
import { AuthSplit } from "@/components/auth/auth-split"

/**
 * OAuth / email-confirmation landing. The Supabase client is configured with
 * detectSessionInUrl, so it exchanges the code in the URL for a session on
 * load; this page just waits for that to resolve and then sends the visitor
 * home (or shows what went wrong).
 */
export default function AuthCallbackPage() {
    const router = useRouter()
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!isSupabaseConfigured) {
            setError("Accounts aren’t configured yet.")
            return
        }

        const params = new URLSearchParams(window.location.hash.replace(/^#/, ""))
        const urlError = new URL(window.location.href).searchParams.get("error_description") ?? params.get("error_description")
        if (urlError) {
            setError(urlError)
            return
        }

        let cancelled = false
        getSupabase()
            .auth.getSession()
            .then(({ data }) => {
                if (cancelled) return
                if (data.session) router.replace("/")
                else setError("That sign-in link has expired. Please try again.")
            })
            .catch(() => {
                if (!cancelled) setError("Couldn’t complete sign-in. Please try again.")
            })

        return () => {
            cancelled = true
        }
    }, [router])

    return (
        <AuthSplit>
            <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-lg font-semibold text-foreground">
                {error ? "Sign-in didn’t finish" : "Signing you in…"}
            </p>
            {error && <p className="text-sm text-muted-foreground">{error}</p>}
            {error && (
                <a href="/sign-in" className="text-sm font-semibold text-primary">
                    Back to sign in
                </a>
            )}
            </div>
        </AuthSplit>
    )
}
