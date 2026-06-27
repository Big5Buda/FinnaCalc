"use client"

import * as React from "react"
import type { Session } from "@supabase/supabase-js"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase"

type User = { id: string; email: string; name: string }

type SignUpResult = { needsConfirmation: boolean }

type AuthContextValue = {
    user: User | null
    loading: boolean
    configured: boolean
    signIn: (email: string, password: string) => Promise<void>
    signUp: (email: string, password: string, name: string) => Promise<SignUpResult>
    signOut: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

function toUser(session: Session | null): User | null {
    const u = session?.user
    if (!u) return null
    const metaName = (u.user_metadata?.name as string | undefined)?.trim()
    return {
        id: u.id,
        email: u.email ?? "",
        name: metaName || (u.email ? u.email.split("@")[0] : ""),
    }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = React.useState<User | null>(null)
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        // Without credentials, behave as a signed-out app instead of crashing.
        if (!isSupabaseConfigured) {
            setLoading(false)
            return
        }

        const supabase = getSupabase()
        let active = true

        supabase.auth.getSession().then(({ data }) => {
            if (!active) return
            setUser(toUser(data.session))
            setLoading(false)
        })

        const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(toUser(session))
        })

        return () => {
            active = false
            subscription.subscription.unsubscribe()
        }
    }, [])

    const signIn = React.useCallback(async (email: string, password: string) => {
        const supabase = getSupabase()
        const { error } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password,
        })
        if (error) throw new Error(error.message)
    }, [])

    const signUp = React.useCallback(
        async (email: string, password: string, name: string): Promise<SignUpResult> => {
            const supabase = getSupabase()
            const { data, error } = await supabase.auth.signUp({
                email: email.trim().toLowerCase(),
                password,
                options: { data: { name: name.trim() } },
            })
            if (error) throw new Error(error.message)
            // When email confirmation is required, Supabase returns a user but no session.
            return { needsConfirmation: !data.session }
        },
        []
    )

    const signOut = React.useCallback(async () => {
        if (!isSupabaseConfigured) return
        await getSupabase().auth.signOut()
        setUser(null)
    }, [])

    const value = React.useMemo(
        () => ({ user, loading, configured: isSupabaseConfigured, signIn, signUp, signOut }),
        [user, loading, signIn, signUp, signOut]
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const ctx = React.useContext(AuthContext)
    if (!ctx) throw new Error("useAuth must be used within AuthProvider")
    return ctx
}
