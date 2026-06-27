"use client"

import * as React from "react"
import { useAuth } from "@/lib/auth"

type Provider = "google" | "apple"

export function OAuthButtons({ label = "Or continue with" }: { label?: string }) {
    const { signInWithOAuth } = useAuth()
    const [pending, setPending] = React.useState<Provider | null>(null)
    const [error, setError] = React.useState<string | null>(null)

    const handle = async (provider: Provider) => {
        setError(null)
        setPending(provider)
        try {
            // Redirects the browser to the provider on success.
            await signInWithOAuth(provider)
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not start sign-in. Please try again.")
            setPending(null)
        }
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
                <div className="flex-1 h-px bg-border" />
            </div>

            {error && <p className="text-sm text-red-500 text-center">{error}</p>}

            <button
                type="button"
                onClick={() => handle("google")}
                disabled={pending !== null}
                className="w-full rounded-full bg-background border border-border font-bold py-3 hover:bg-accent transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
                </svg>
                {pending === "google" ? "Redirecting…" : "Continue with Google"}
            </button>

            <button
                type="button"
                onClick={() => handle("apple")}
                disabled={pending !== null}
                className="w-full rounded-full bg-background border border-border font-bold py-3 hover:bg-accent transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M16.365 1.43c0 1.14-.42 2.21-1.18 3.04-.81.89-2.13 1.58-3.36 1.49-.16-1.18.46-2.39 1.18-3.16.79-.86 2.16-1.49 3.36-1.37zM20.5 17.36c-.55 1.27-.81 1.83-1.52 2.96-.99 1.57-2.39 3.52-4.13 3.54-1.55.02-1.95-1.01-4.05-1-2.1.01-2.54 1.02-4.09.99-1.74-.03-3.07-1.78-4.06-3.35-2.78-4.39-3.07-9.54-1.36-12.28 1.21-1.95 3.13-3.09 4.93-3.09 1.83 0 2.98.99 4.49.99 1.46 0 2.36-.99 4.48-.99 1.6 0 3.3.87 4.51 2.36-3.97 2.18-3.32 7.86.8 9.87z" />
                </svg>
                {pending === "apple" ? "Redirecting…" : "Continue with Apple"}
            </button>
        </div>
    )
}
