"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Calculator } from "lucide-react"
import { useAuth } from "@/lib/auth"

export default function AuthCallbackPage() {
    const router = useRouter()
    const { user, loading } = useAuth()
    const [error, setError] = React.useState<string | null>(null)

    // Surface any error the provider passed back in the URL (hash or query).
    React.useEffect(() => {
        const params = new URLSearchParams(
            window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.search
        )
        const err = params.get("error_description") || params.get("error")
        if (err) setError(err.replace(/\+/g, " "))
    }, [])

    // The browser Supabase client auto-detects the session from the URL hash
    // (detectSessionInUrl) and fires onAuthStateChange, which populates `user`.
    React.useEffect(() => {
        if (!error && !loading && user) router.replace("/")
    }, [error, loading, user, router])

    // Fallback: if no session materializes, return to sign-in.
    React.useEffect(() => {
        if (error) return
        const timer = setTimeout(() => {
            if (!user) router.replace("/sign-in")
        }, 8000)
        return () => clearTimeout(timer)
    }, [error, user, router])

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-background flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md text-center">
                <div className="flex justify-center mb-8">
                    <div className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center">
                        <Calculator className="h-6 w-6" />
                    </div>
                </div>

                {error ? (
                    <>
                        <h1 className="text-2xl font-bold text-foreground mb-2">Sign-in failed</h1>
                        <p className="text-muted-foreground mb-8">{error}</p>
                        <Link
                            href="/sign-in"
                            className="inline-block w-full rounded-full bg-foreground text-background font-bold py-3 hover:bg-foreground/90 transition-colors"
                        >
                            Back to sign in
                        </Link>
                    </>
                ) : (
                    <>
                        <div className="flex justify-center mb-4">
                            <span className="inline-block h-8 w-8 rounded-full border-2 border-muted border-t-foreground animate-spin" />
                        </div>
                        <h1 className="text-2xl font-bold text-foreground mb-1">Signing you in…</h1>
                        <p className="text-muted-foreground">Hang tight, finishing up.</p>
                    </>
                )}
            </div>
        </div>
    )
}
