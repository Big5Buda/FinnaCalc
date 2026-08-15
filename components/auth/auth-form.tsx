"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, type FormEvent } from "react"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/components/providers/auth-provider"
import { Badge, Button, Notice } from "@/components/ui/primitives"
import { Wordmark } from "@/components/shell/wordmark"

/**
 * Sign in / create account — the web port of Features/Auth/AuthView.swift:
 * email + password with a name on sign-up, needs-confirmation handling, Sign
 * in with Apple, Google, and a password reset.
 */
export function AuthForm({ mode }: { mode: "signIn" | "signUp" }) {
    const { user, configured, signIn, signUp, signInWithApple, signInWithGoogle, resetPassword } = useAuth()
    const router = useRouter()
    const params = useSearchParams()
    const next = params.get("next") ?? "/"

    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [info, setInfo] = useState<string | null>(null)
    const [working, setWorking] = useState(false)

    // Someone who is already signed in has nothing to do here.
    useEffect(() => {
        if (user) router.replace(next)
    }, [user, next, router])

    const canSubmit = email.trim() !== "" && password !== "" && (mode === "signIn" || name.trim() !== "")

    async function onSubmit(event: FormEvent) {
        event.preventDefault()
        setError(null)
        setInfo(null)
        setWorking(true)
        try {
            if (mode === "signIn") {
                await signIn(email, password)
                router.replace(next)
            } else {
                const { needsConfirmation } = await signUp(email, password, name)
                if (needsConfirmation) {
                    setInfo("Check your email to confirm your account, then sign in.")
                } else {
                    router.replace(next)
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
        }
        setWorking(false)
    }

    async function onOAuth(provider: "apple" | "google") {
        setError(null)
        setInfo(null)
        setWorking(true)
        try {
            await (provider === "apple" ? signInWithApple() : signInWithGoogle())
            // The browser leaves for the provider; nothing further to do here.
        } catch (err) {
            setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.")
            setWorking(false)
        }
    }

    async function onReset() {
        setError(null)
        setInfo(null)
        if (email.trim() === "") {
            setError("Enter your email above first, then choose Forgot password.")
            return
        }
        setWorking(true)
        try {
            await resetPassword(email)
            setInfo("Password reset email sent — check your inbox.")
        } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't send the reset email.")
        }
        setWorking(false)
    }

    return (
        <div className="mx-auto flex w-full max-w-sm flex-col gap-4 px-5 py-10">
            <div className="flex justify-center pb-2">
                <Wordmark className="text-3xl" />
            </div>

            <div className="flex rounded-full bg-secondary p-[3px] text-center">
                <Link
                    href={`/sign-in?next=${encodeURIComponent(next)}`}
                    className={`flex-1 rounded-full py-2 text-sm ${mode === "signIn" ? "bg-card font-bold text-foreground shadow-sm" : "font-semibold text-muted-foreground"}`}
                >
                    Sign in
                </Link>
                <Link
                    href={`/sign-up?next=${encodeURIComponent(next)}`}
                    className={`flex-1 rounded-full py-2 text-sm ${mode === "signUp" ? "bg-card font-bold text-foreground shadow-sm" : "font-semibold text-muted-foreground"}`}
                >
                    Sign up
                </Link>
            </div>

            {!configured && <Badge variant="secondary">Accounts aren’t configured yet</Badge>}

            <form onSubmit={onSubmit} className="flex flex-col gap-3">
                {mode === "signUp" && (
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        autoComplete="name"
                        className={FIELD}
                    />
                )}
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className={FIELD}
                />
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "signUp" ? "Create a password (min. 6 characters)" : "Your password"}
                    autoComplete={mode === "signUp" ? "new-password" : "current-password"}
                    className={FIELD}
                />

                {mode === "signIn" && (
                    <button
                        type="button"
                        onClick={onReset}
                        disabled={working}
                        className="self-end text-sm font-semibold text-primary"
                    >
                        Forgot password?
                    </button>
                )}

                {error && <Notice tone="error">{error}</Notice>}
                {info && <Notice tone="info">{info}</Notice>}

                <Button size="lg" type="submit" disabled={working || !canSubmit || !configured}>
                    {working && <Loader2 className="h-4 w-4 animate-spin" />}
                    {mode === "signIn" ? "Sign in" : "Create account"}
                </Button>
            </form>

            <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <span className="h-px flex-1 bg-border" />
            </div>

            <Button variant="outline" size="lg" onClick={() => onOAuth("apple")} disabled={working || !configured}>
                Continue with Apple
            </Button>
            <Button variant="outline" size="lg" onClick={() => onOAuth("google")} disabled={working || !configured}>
                Continue with Google
            </Button>

            <p className="pt-2 text-center text-xs text-muted-foreground">
                By continuing you agree to our{" "}
                <Link href="/terms" className="font-semibold text-primary">
                    Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="font-semibold text-primary">
                    Privacy Policy
                </Link>
                .
            </p>
        </div>
    )
}

const FIELD =
    "h-11 w-full rounded-md border border-input bg-background px-3.5 text-base text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
