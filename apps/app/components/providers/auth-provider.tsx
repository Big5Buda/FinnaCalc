"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase"
import { clearSessionHint, setSessionHint } from "@/lib/session-hint"

/**
 * Auth state for the site — the browser twin of the iOS app's
 * Core/Auth/AuthManager.swift: email+password, Sign in with Apple, Google, and
 * a password reset. Sessions persist in localStorage and refresh themselves.
 */

export type AuthUser = {
    id: string
    email: string
    /** Display name from user metadata, falling back to the email local part. */
    displayName: string
}

type SignUpResult = { needsConfirmation: boolean }

type AuthContextValue = {
    user: AuthUser | null
    /** True until the initial session restore resolves. */
    loading: boolean
    /** Whether Supabase credentials are present at all. */
    configured: boolean
    signIn: (email: string, password: string) => Promise<void>
    signUp: (email: string, password: string, name: string) => Promise<SignUpResult>
    signInWithApple: () => Promise<void>
    signInWithGoogle: () => Promise<void>
    resetPassword: (email: string) => Promise<void>
    updatePassword: (password: string) => Promise<void>
    signOut: () => Promise<void>
    deleteAccount: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function toAuthUser(user: User | null | undefined): AuthUser | null {
    if (!user) return null
    const email = user.email ?? ""
    const metaName =
        (user.user_metadata?.name as string | undefined) ||
        (user.user_metadata?.full_name as string | undefined) ||
        ""
    return {
        id: user.id,
        email,
        displayName: metaName || (email ? email.split("@")[0] : "Your account"),
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null)
    const [loading, setLoading] = useState(isSupabaseConfigured)

    useEffect(() => {
        if (!isSupabaseConfigured) return
        const supabase = getSupabase()
        let active = true

        supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
            if (!active) return
            const restored = toAuthUser(data.session?.user)
            setUser(restored)
            // One bit for the marketing site's header — never the session
            // itself; see lib/session-hint.ts.
            if (restored) setSessionHint()
            else clearSessionHint()
            setLoading(false)
        })

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            const next = toAuthUser(session?.user)
            setUser(next)
            if (next) setSessionHint()
            else clearSessionHint()
            setLoading(false)
        })

        return () => {
            active = false
            sub.subscription.unsubscribe()
        }
    }, [])

    const signIn = useCallback(async (email: string, password: string) => {
        const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw new Error(error.message)
    }, [])

    const signUp = useCallback(async (email: string, password: string, name: string): Promise<SignUpResult> => {
        const { data, error } = await getSupabase().auth.signUp({
            email: email.trim(),
            password,
            options: {
                data: { name: name.trim() },
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        })
        if (error) throw new Error(error.message)
        // No session back means Supabase is waiting on email confirmation.
        return { needsConfirmation: !data.session }
    }, [])

    const oauth = useCallback(async (provider: "apple" | "google") => {
        const { error } = await getSupabase().auth.signInWithOAuth({
            provider,
            options: { redirectTo: `${window.location.origin}/auth/callback` },
        })
        if (error) throw new Error(error.message)
    }, [])

    const resetPassword = useCallback(async (email: string) => {
        const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
            redirectTo: `${window.location.origin}/auth/reset`,
        })
        if (error) throw new Error(error.message)
    }, [])

    const updatePassword = useCallback(async (password: string) => {
        const { error } = await getSupabase().auth.updateUser({ password })
        if (error) throw new Error(error.message)
    }, [])

    const signOut = useCallback(async () => {
        await getSupabase().auth.signOut()
        clearSessionHint()
        setUser(null)
    }, [])

    /**
     * Supabase can't delete its own user from the browser (that needs the
     * service-role key), so this calls /api/account/delete, which resolves the
     * user from the Bearer token and deletes them admin-side.
     */
    const deleteAccount = useCallback(async () => {
        const { apiPost } = await import("@/lib/api-client")
        await apiPost("/api/account/delete")
        await getSupabase().auth.signOut()
        clearSessionHint()
        setUser(null)
    }, [])

    const value = useMemo<AuthContextValue>(
        () => ({
            user,
            loading,
            configured: isSupabaseConfigured,
            signIn,
            signUp,
            signInWithApple: () => oauth("apple"),
            signInWithGoogle: () => oauth("google"),
            resetPassword,
            updatePassword,
            signOut,
            deleteAccount,
        }),
        [user, loading, signIn, signUp, oauth, resetPassword, updatePassword, signOut, deleteAccount]
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
    return ctx
}
