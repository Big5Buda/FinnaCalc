"use client"

import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/components/providers/auth-provider"
import { Button, Notice } from "@/components/ui/primitives"
import { Wordmark } from "@/components/shell/wordmark"

/**
 * Where the password-reset email lands. Supabase signs the visitor in from the
 * link's token, so this only has to set the new password.
 */
export default function ResetPasswordPage() {
    const { updatePassword } = useAuth()
    const router = useRouter()
    const [password, setPassword] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [done, setDone] = useState(false)
    const [working, setWorking] = useState(false)

    async function onSubmit(event: FormEvent) {
        event.preventDefault()
        setError(null)
        setWorking(true)
        try {
            await updatePassword(password)
            setDone(true)
            setTimeout(() => router.replace("/"), 1200)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't update your password.")
        }
        setWorking(false)
    }

    return (
        <div className="mx-auto flex w-full max-w-sm flex-col gap-4 px-5 py-16">
            <div className="flex justify-center pb-2">
                <Wordmark className="text-3xl" />
            </div>
            <h1 className="text-center text-lg font-bold text-foreground">Choose a new password</h1>

            <form onSubmit={onSubmit} className="flex flex-col gap-3">
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="New password (min. 6 characters)"
                    autoComplete="new-password"
                    className="h-11 w-full rounded-md border border-input bg-background px-3.5 text-base text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
                />
                {error && <Notice tone="error">{error}</Notice>}
                {done && <Notice tone="info">Password updated. Taking you back…</Notice>}
                <Button size="lg" type="submit" disabled={working || password.length < 6}>
                    {working && <Loader2 className="h-4 w-4 animate-spin" />}
                    Update password
                </Button>
            </form>
        </div>
    )
}
