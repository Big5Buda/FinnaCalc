"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Calculator } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { OAuthButtons } from "@/components/oauth-buttons"

export default function SignInPage() {
    const router = useRouter()
    const { signIn, user } = useAuth()
    const [step, setStep] = React.useState<"email" | "password">("email")
    const [email, setEmail] = React.useState("")
    const [password, setPassword] = React.useState("")
    const [error, setError] = React.useState<string | null>(null)
    const [submitting, setSubmitting] = React.useState(false)

    React.useEffect(() => {
        if (user) router.replace("/")
    }, [user, router])

    const handleNext = (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        if (!email.trim()) {
            setError("Please enter your email.")
            return
        }
        setStep("password")
    }

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSubmitting(true)
        try {
            await signIn(email, password)
            router.push("/")
        } catch (err) {
            setError(err instanceof Error ? err.message : "Sign in failed.")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-background flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md">
                <div className="flex justify-center mb-8">
                    <div className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center">
                        <Calculator className="h-6 w-6" />
                    </div>
                </div>
                <h1 className="text-3xl font-bold text-foreground mb-8">
                    {step === "email" ? "Sign in to FinnaCalc" : "Enter your password"}
                </h1>

                {step === "email" ? (
                    <form onSubmit={handleNext} className="space-y-6">
                        <FloatingInput
                            label="Email"
                            type="email"
                            autoComplete="email"
                            autoFocus
                            value={email}
                            onChange={(v) => setEmail(v)}
                        />

                        {error && <p className="text-sm text-red-500">{error}</p>}

                        <button
                            type="submit"
                            className="w-full rounded-full bg-foreground text-background font-bold py-3 hover:bg-foreground/90 transition-colors"
                        >
                            Next
                        </button>

                        <OAuthButtons />

                        <p className="text-sm text-muted-foreground text-center">
                            Don't have an account?{" "}
                            <Link href="/sign-up" className="text-blue-500 hover:underline">
                                Sign up
                            </Link>
                        </p>
                    </form>
                ) : (
                    <form onSubmit={handleSignIn} className="space-y-6">
                        <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                            {email}
                        </div>
                        <FloatingInput
                            label="Password"
                            type="password"
                            autoComplete="current-password"
                            autoFocus
                            value={password}
                            onChange={(v) => setPassword(v)}
                        />

                        {error && <p className="text-sm text-red-500">{error}</p>}

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full rounded-full bg-foreground text-background font-bold py-3 hover:bg-foreground/90 transition-colors disabled:opacity-60"
                        >
                            {submitting ? "Signing in..." : "Log in"}
                        </button>

                        <button
                            type="button"
                            onClick={() => { setStep("email"); setError(null); setPassword("") }}
                            className="w-full rounded-full border border-border font-bold py-3 hover:bg-accent transition-colors"
                        >
                            Use a different email
                        </button>

                        <p className="text-sm text-muted-foreground text-center">
                            Don't have an account?{" "}
                            <Link href="/sign-up" className="text-blue-500 hover:underline">
                                Sign up
                            </Link>
                        </p>
                    </form>
                )}
            </div>
        </div>
    )
}

function FloatingInput({
    label,
    value,
    onChange,
    type = "text",
    autoComplete,
    autoFocus,
}: {
    label: string
    value: string
    onChange: (v: string) => void
    type?: string
    autoComplete?: string
    autoFocus?: boolean
}) {
    const id = React.useId()
    const [focused, setFocused] = React.useState(false)
    const floated = focused || value.length > 0

    return (
        <div className={`relative rounded-md border bg-background transition-colors ${focused ? "border-blue-500 ring-1 ring-blue-500" : "border-border"}`}>
            <label
                htmlFor={id}
                className={`absolute left-3 pointer-events-none transition-all ${floated ? "top-1.5 text-xs text-muted-foreground" : "top-4 text-base text-muted-foreground"} ${focused ? "text-blue-500" : ""}`}
            >
                {label}
            </label>
            <input
                id={id}
                type={type}
                autoComplete={autoComplete}
                autoFocus={autoFocus}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                className="w-full bg-transparent outline-none px-3 pt-6 pb-2 text-foreground"
            />
        </div>
    )
}

