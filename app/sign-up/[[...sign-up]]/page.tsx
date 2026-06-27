"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Calculator } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { OAuthButtons } from "@/components/oauth-buttons"

export default function SignUpPage() {
    const router = useRouter()
    const { signUp, user } = useAuth()
    const [name, setName] = React.useState("")
    const [email, setEmail] = React.useState("")
    const [password, setPassword] = React.useState("")
    const [error, setError] = React.useState<string | null>(null)
    const [submitting, setSubmitting] = React.useState(false)
    const [confirmSent, setConfirmSent] = React.useState(false)

    React.useEffect(() => {
        if (user) router.replace("/")
    }, [user, router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        if (!name.trim()) return setError("Please enter your name.")
        if (!email.trim()) return setError("Please enter your email.")
        setSubmitting(true)
        try {
            const { needsConfirmation } = await signUp(email, password, name)
            if (needsConfirmation) {
                setConfirmSent(true)
            } else {
                router.push("/")
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Sign up failed.")
        } finally {
            setSubmitting(false)
        }
    }

    if (confirmSent) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-background flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-md text-center">
                    <div className="flex justify-center mb-8">
                        <div className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center">
                            <Calculator className="h-6 w-6" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-foreground mb-2">Check your email</h1>
                    <p className="text-muted-foreground mb-8">
                        We sent a confirmation link to <span className="font-semibold text-foreground">{email}</span>.
                        Click it to activate your account, then sign in.
                    </p>
                    <Link
                        href="/sign-in"
                        className="inline-block w-full rounded-full bg-foreground text-background font-bold py-3 hover:bg-foreground/90 transition-colors"
                    >
                        Go to sign in
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-background flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md">
                <div className="flex justify-center mb-8">
                    <div className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center">
                        <Calculator className="h-6 w-6" />
                    </div>
                </div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Create your account</h1>
                <p className="text-muted-foreground mb-8">Save your calculations and progress across devices.</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <FloatingInput label="Name" value={name} onChange={setName} autoComplete="name" autoFocus />
                    <FloatingInput label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
                    <FloatingInput label="Password" value={password} onChange={setPassword} type="password" autoComplete="new-password" />

                    <p className="text-xs text-muted-foreground">
                        By signing up, you agree to our{" "}
                        <Link href="/terms" className="text-blue-500 hover:underline">Terms</Link>
                        {" "}and{" "}
                        <Link href="/privacy" className="text-blue-500 hover:underline">Privacy Policy</Link>.
                    </p>

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full rounded-full bg-foreground text-background font-bold py-3 hover:bg-foreground/90 transition-colors disabled:opacity-60"
                    >
                        {submitting ? "Creating account..." : "Sign up"}
                    </button>

                    <OAuthButtons label="Or sign up with" />

                    <p className="text-sm text-muted-foreground text-center pt-2">
                        Already have an account?{" "}
                        <Link href="/sign-in" className="text-blue-500 hover:underline">
                            Sign in
                        </Link>
                    </p>
                </form>
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
