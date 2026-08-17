"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, type FormEvent } from "react"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/providers/auth-provider"

/**
 * The sign-in / sign-up card — the web port of Features/Auth/AuthView.swift
 * (email + password with a name on sign-up, needs-confirmation handling, Sign
 * in with Apple, Google, and a password reset), laid out as the card that sits
 * on the right of the split-screen auth page.
 *
 * New passwords must be at least 10 characters. Supabase's own floor is 6, so
 * this is enforced here on sign-up only: an existing account created under the
 * old rule still signs in with the password it has, which is the whole point of
 * not enforcing it on the sign-in side.
 */
const MIN_NEW_PASSWORD = 10

export function AuthForm({ mode }: { mode: "signIn" | "signUp" }) {
    const { user, configured, signIn, signUp, signInWithApple, signInWithGoogle, resetPassword } = useAuth()
    const router = useRouter()
    /**
     * Where to go once authenticated. Read from the URL after mount rather than
     * through useSearchParams: that hook forces the whole card behind a Suspense
     * boundary, which left the page rendering an empty panel until hydration.
     * Nothing here needs the value before then.
     */
    const [next, setNext] = useState("/")
    useEffect(() => {
        const target = new URLSearchParams(window.location.search).get("next")
        if (target) setNext(target)
    }, [])

    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [info, setInfo] = useState<string | null>(null)
    const [working, setWorking] = useState(false)

    // Someone who is already signed in has nothing to do here.
    useEffect(() => {
        if (user) router.replace(next)
    }, [user, next, router])

    const passwordLongEnough = mode === "signIn" || password.length >= MIN_NEW_PASSWORD
    const canSubmit = email.trim() !== "" && password !== "" && passwordLongEnough

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
                    setInfo("Check your email to confirm your account, then log in.")
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
            setError("Enter your email first, then choose Forgot password.")
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
        <div className="flex flex-col gap-5">
            <h2 className="text-center text-2xl font-medium tracking-[0.005em] text-[#1C1B1B]">
                {mode === "signIn" ? "Log in" : "Sign up"}
            </h2>

            {!configured && (
                <div className="flex justify-center">
                    <span className="rounded-full bg-[#F1F0F0] px-3 py-1 text-xs font-medium text-[#686664]">
                        Accounts aren&rsquo;t configured yet
                    </span>
                </div>
            )}

            <form onSubmit={onSubmit} className="flex flex-col gap-3">
                {mode === "signUp" && (
                    <Field
                        label="Preferred name (Optional)"
                        value={name}
                        onChange={setName}
                        autoComplete="name"
                    />
                )}
                <Field
                    label="Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    autoComplete="email"
                />
                <Field
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={setPassword}
                    autoComplete={mode === "signUp" ? "new-password" : "current-password"}
                    trailing={
                        <button
                            type="button"
                            onClick={() => setShowPassword((shown) => !shown)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            className="text-[#686664] transition hover:text-[#1C1B1B]"
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    }
                />

                {mode === "signUp" ? (
                    <p
                        className={cn(
                            "text-sm",
                            password !== "" && !passwordLongEnough ? "text-[#A43D12]" : "text-[#686664]"
                        )}
                    >
                        Minimum {MIN_NEW_PASSWORD} characters.
                    </p>
                ) : (
                    <button
                        type="button"
                        onClick={onReset}
                        disabled={working}
                        className="self-start text-sm font-medium text-[#1C1B1B] underline underline-offset-4"
                    >
                        Forgot password?
                    </button>
                )}

                {mode === "signUp" && (
                    <p className="text-xs leading-relaxed text-[#686664]">
                        By signing up, you agree to FinnaCalc&rsquo;s{" "}
                        <Link href="/terms" className="underline underline-offset-2">
                            Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link href="/privacy" className="underline underline-offset-2">
                            Privacy Policy
                        </Link>
                        . We email you about your account; we don&rsquo;t sell your address.
                    </p>
                )}

                {error && (
                    <p className="rounded-md bg-[#A43D12]/10 p-3 text-sm text-[#A43D12]">{error}</p>
                )}
                {info && (
                    <p className="rounded-md bg-[#1C1B1B]/[0.06] p-3 text-sm text-[#1C1B1B]">{info}</p>
                )}

                <button
                    type="submit"
                    disabled={working || !canSubmit || !configured}
                    className="mt-1 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#1C1B1B] text-base font-medium text-[#FCFCFC] transition hover:bg-[#494645] disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {working && <Loader2 className="h-4 w-4 animate-spin" />}
                    {mode === "signIn" ? "Log in" : "Next"}
                </button>
            </form>

            <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-[#E4E2E1]" />
                <span className="text-xs text-[#686664]">or</span>
                <span className="h-px flex-1 bg-[#E4E2E1]" />
            </div>

            <div className="flex flex-col gap-2.5">
                <OAuthButton label="Continue with Apple" onClick={() => onOAuth("apple")} disabled={working || !configured} />
                <OAuthButton label="Continue with Google" onClick={() => onOAuth("google")} disabled={working || !configured} />
            </div>

            <p className="text-center text-sm text-[#686664]">
                {mode === "signIn" ? "New to FinnaCalc?" : "Already have an account?"}{" "}
                <Link
                    href={`${mode === "signIn" ? "/sign-up" : "/sign-in"}?next=${encodeURIComponent(next)}`}
                    className="font-medium text-[#1C1B1B] underline underline-offset-4"
                >
                    {mode === "signIn" ? "Sign up here" : "Log in here"}
                </Link>
            </p>
        </div>
    )
}

/** A field whose label sits inside the control, as on the reference card. */
function Field({
    label,
    value,
    onChange,
    type = "text",
    autoComplete,
    trailing,
}: {
    label: string
    value: string
    onChange: (value: string) => void
    type?: string
    autoComplete?: string
    trailing?: React.ReactNode
}) {
    return (
        <label className="flex h-14 items-center gap-2 rounded-[12px] bg-[#F1F0F0] px-4 transition focus-within:ring-2 focus-within:ring-[#1C1B1B]">
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[11px] font-medium text-[#686664]">{label}</span>
                <input
                    type={type}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    autoComplete={autoComplete}
                    className="w-full bg-transparent text-base text-[#1C1B1B] outline-none"
                />
            </span>
            {trailing}
        </label>
    )
}

function OAuthButton({
    label,
    onClick,
    disabled,
}: {
    label: string
    onClick: () => void
    disabled: boolean
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="inline-flex h-12 items-center justify-center rounded-full border border-[#1C1B1B] text-base font-medium text-[#1C1B1B] transition hover:bg-[#1C1B1B]/5 disabled:opacity-40"
        >
            {label}
        </button>
    )
}
